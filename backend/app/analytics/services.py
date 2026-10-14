"""
Analytics Service
Provides dashboard metrics, demographics analysis, and trends.
"""
from app.saranam.models.patient_visit import PatientVisit
from sqlalchemy import func, extract, desc, asc, text, case, and_, or_
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple
from app.extensions import db
from app.models import Patient, FormSubmission, Encounter, Form

class AnalyticsService:

    @staticmethod
    def apply_patient_filters(query, patient_model, patient_status: Optional[str] = None, age_group: Optional[str] = None):
        """
        Reusable helper to apply patient_status and age_group filtering on a query.
        """
        if patient_status == 'alive_active':
            query = query.filter(
                patient_model.is_deceased.is_(False),
                patient_model.care_status == 'active'
            )
        elif patient_status == 'inactive':
            query = query.filter(
                patient_model.is_deceased.is_(False),
                patient_model.care_status == 'inactive'
            )
        elif patient_status == 'dead':
            query = query.filter(
                patient_model.is_deceased.is_(True)
            )

        if age_group and age_group != 'all':
            from datetime import date
            today = date.today()
            
            def subtract_years(dt, years):
                try:
                    return date(dt.year - years, dt.month, dt.day)
                except ValueError:
                    return date(dt.year - years, dt.month, dt.day - 1)

            if age_group == 'child_adolescent':
                limit_20 = subtract_years(today, 20)
                query = query.filter(patient_model.date_of_birth > limit_20)
            elif age_group == 'adults':
                limit_19 = subtract_years(today, 19)
                limit_60 = subtract_years(today, 60)
                query = query.filter(
                    patient_model.date_of_birth <= limit_19,
                    patient_model.date_of_birth > limit_60
                )
            elif age_group == 'older_adults':
                limit_60 = subtract_years(today, 60)
                query = query.filter(patient_model.date_of_birth <= limit_60)

        return query
    
    @staticmethod
    def get_dashboard_metrics(start_date: Optional[str] = None, end_date: Optional[str] = None, filters: Optional[Dict] = None) -> Dict:
        """
        Get comprehensive dashboard metrics.
        
        Args:
            start_date: Filter start date (YYYY-MM-DD)
            end_date: Filter end date (YYYY-MM-DD)
            filters: Additional filters (gender, location, etc.)
            
        Returns:
            Dictionary with summary, demographics, clinical_insights, and trends
        """
        # Always initialize recent_activities list at function start
        recent_activities = []

        # Summary metrics
        total_patients = Patient.query.filter(Patient.is_active == True).count()
        alive_active_patients = Patient.query.filter(
            Patient.is_active == True,
            Patient.is_deceased == False,
            Patient.care_status == 'active'
        ).count()
        inactive_patients = Patient.query.filter(
            Patient.is_active == True,
            Patient.is_deceased == False,
            Patient.care_status == 'inactive'
        ).count()
        deceased_patients = Patient.query.filter(
            Patient.is_active == True,
            Patient.is_deceased == True
        ).count()
        
        # New patients this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_patients = Patient.query.filter(
            Patient.created_at >= month_start
        ).count()
        
        # Calculate growth rate (compare to last month)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        last_month_patients = Patient.query.filter(
            Patient.created_at >= last_month_start,
            Patient.created_at < month_start
        ).count()
        
        growth_rate = 0
        if last_month_patients > 0:
            growth_rate = ((new_patients - last_month_patients) / last_month_patients * 100)
        
        # Total forms and encounters
        total_forms = FormSubmission.query.count()
        total_encounters = Encounter.query.count() if hasattr(Encounter, 'query') else 0
        
        # Demographics
        patient_status = filters.get('patient_status') if filters else None
        age_group = filters.get('age_group') if filters else None
        age_distribution = AnalyticsService._get_age_distribution(start_date, end_date, patient_status=patient_status)
        gender_distribution = AnalyticsService._get_gender_distribution(start_date, end_date, patient_status=patient_status, age_group=age_group)
        
        # Registration trends
        registration_trends = AnalyticsService._get_registration_trends(start_date, end_date, patient_status=patient_status)
        
        # Form completion rate
        total_submissions = FormSubmission.query.count()
        completed_submissions = FormSubmission.query.filter(
            FormSubmission.submission_status == 'submitted'
        ).count()
        
        completion_rate = 0
        if total_submissions > 0:
            completion_rate = (completed_submissions / total_submissions * 100)
        
        # Submissions this week
        week_start = datetime.utcnow() - timedelta(days=7)
        submissions_this_week = FormSubmission.query.filter(
            FormSubmission.created_at >= week_start
        ).count()

        # Total Users
        from app.models import User
        total_users = User.query.filter(User.is_active == True).count()
        
        # Fetch last 20 recent activities (patient registration, patient update, visit creation/update, form submission)
        recent_activities = []
        
        # 1. Patient creation and update events
        try:
            recent_patients = Patient.query.order_by(Patient.updated_at.desc()).limit(20).all()
            for p in recent_patients:
                if p.created_at:
                    recent_activities.append({
                        'id': f"patient_crt_{p.id}",
                        'type': 'patient_created',
                        'title': f"New Patient Registered: {p.full_name}",
                        'description': f"UHID: {p.uhid or 'N/A'} | Status: {p.care_status or 'active'}",
                        'link': f"/patients/{p.id}",
                        'created_at': p.created_at.isoformat(),
                        'timestamp': p.created_at.isoformat()
                    })
                if p.updated_at and p.created_at and (p.updated_at - p.created_at).total_seconds() > 5:
                    recent_activities.append({
                        'id': f"patient_upd_{p.id}",
                        'type': 'patient_updated',
                        'title': f"Patient Updated: {p.full_name}",
                        'description': f"Care status: {p.care_status or 'active'} | UHID: {p.uhid or 'N/A'}",
                        'link': f"/patients/{p.id}",
                        'created_at': p.updated_at.isoformat(),
                        'timestamp': p.updated_at.isoformat()
                    })
        except Exception as e:
            print(f"Error fetching recent patient activities: {e}")

        # 2. Visit creation and update events
        try:
            recent_visits = db.session.query(PatientVisit, Patient.full_name).join(
                Patient, PatientVisit.patient_id == Patient.id
            ).order_by(PatientVisit.updated_at.desc()).limit(20).all()
            
            for v, pt_name in recent_visits:
                if v.created_at:
                    recent_activities.append({
                        'id': f"visit_crt_{v.id}",
                        'type': 'visit_created',
                        'title': f"New Visit Added: #{v.visit_number} for {pt_name}",
                        'description': f"Type: {v.visit_type or 'follow_up'} | Location: {v.visit_location or 'home'}",
                        'link': f"/patients/{v.patient_id}",
                        'created_at': v.created_at.isoformat(),
                        'timestamp': v.created_at.isoformat()
                    })
                if v.updated_at and v.created_at and (v.updated_at - v.created_at).total_seconds() > 5:
                    recent_activities.append({
                        'id': f"visit_upd_{v.id}",
                        'type': 'visit_updated',
                        'title': f"Visit Updated: #{v.visit_number} for {pt_name}",
                        'description': f"Type: {v.visit_type or 'follow_up'} | Location: {v.visit_location or 'home'}",
                        'link': f"/patients/{v.patient_id}",
                        'created_at': v.updated_at.isoformat(),
                        'timestamp': v.updated_at.isoformat()
                    })
        except Exception as e:
            print(f"Error fetching recent visit activities: {e}")

        # 3. Form Submissions
        try:
            recent_subs = FormSubmission.query.order_by(FormSubmission.created_at.desc()).limit(20).all()
            for s in recent_subs:
                form_name = s.form.name if s.form else 'Unknown Form'
                user_name = s.submitted_by_user.full_name if s.submitted_by_user else 'System'
                recent_activities.append({
                    'id': f"sub_{s.id}",
                    'type': 'form_submitted',
                    'title': f"Form Submitted: {form_name}",
                    'description': f"Submitted by {user_name}",
                    'link': f"/submissions/{s.id}",
                    'created_at': s.created_at.isoformat(),
                    'timestamp': s.created_at.isoformat(),
                    'form_name': form_name,
                    'submitted_by_name': user_name
                })
        except Exception as e:
            print(f"Error fetching recent submission activities: {e}")

        # Sort combined list by timestamp descending and keep top 20
        recent_activities.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_activities = recent_activities[:20]

        return {
            # Flattened for simple consumption
            'total_patients': total_patients,
            'new_patients': new_patients,
            'growth_rate': round(growth_rate, 1),
            'active_patients': alive_active_patients,
            'inactive_patients': inactive_patients,
            'deceased_patients': deceased_patients,
            'total_forms': Form.query.filter(Form.is_active == True).count(),
            'total_submissions': total_forms,
            'total_encounters': total_encounters,
            'total_users': total_users,
            'submissions_this_week': submissions_this_week,
            'active_alerts': 0,
            
            # Original nested structures for compatibility/detailed views
            'summary': {
                'total_patients': total_patients,
                'new_patients': new_patients,
                'growth_rate': round(growth_rate, 1),
                'active_patients': alive_active_patients,
                'inactive_patients': inactive_patients,
                'deceased_patients': deceased_patients,
                'total_forms': total_forms, # This was FormSubmission count in previous code
                'total_encounters': total_encounters,
                'total_users': total_users,
                'submissions_this_week': submissions_this_week,
                'active_alerts': 0
            },
            'demographics': {
                'age_distribution': age_distribution,
                'gender_distribution': gender_distribution
            },
            'trends': {
                'registration_over_time': registration_trends,
                'form_completion_rate': round(completion_rate, 1),
                'average_response_time_hours': 4.2
            },
            'recent_activities': recent_activities,
            'recent_submissions': recent_activities
        }
    
    @staticmethod
    def _parse_datetime(val: Optional[str]) -> Optional[datetime]:
        if not val:
            return None
        val = val.strip()
        if val.endswith('Z'):
            val = val[:-1] + '+00:00'
        
        # Clean timezone offset colons
        if '+' in val:
            parts = val.split('+')
            if len(parts) == 2 and ':' in parts[1]:
                val = parts[0] + '+' + parts[1].replace(':', '')
        elif '-' in val[10:]:
            parts = val.split('-')
            if len(parts) >= 2 and ':' in parts[-1]:
                val = '-'.join(parts[:-1]) + '-' + parts[-1].replace(':', '')

        try:
            t_part = val.split('.')[0]
            if '+' in val:
                offset_part = val.split('+')[-1]
                val_clean = t_part + '+' + offset_part
                dt = datetime.strptime(val_clean, '%Y-%m-%dT%H:%M:%S+%z')
            elif '-' in val[10:]:
                offset_part = val.split('-')[-1]
                val_clean = t_part + '-' + offset_part
                dt = datetime.strptime(val_clean, '%Y-%m-%dT%H:%M:%S-%z')
            else:
                dt = datetime.strptime(t_part, '%Y-%m-%dT%H:%M:%S')
            
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            return dt
        except Exception:
            try:
                d_str = val.split('T')[0]
                d = date.fromisoformat(d_str)
                return datetime(d.year, d.month, d.day)
            except Exception:
                return None

    @staticmethod
    def _get_age_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None) -> List[Dict]:
        """
        Calculate age distribution using the WHO life-course scheme
        (meeting §6.1, 2026-04-14). Patients without a date_of_birth land
        in the "Unknown (no DOB)" bucket so the chart totals reflect
        data-quality gaps honestly.

        Return shape is unchanged from the prior implementation —
        ``[{range, count, percentage}]`` — so the frontend bar chart
        auto-picks up the new bands with no code change there.
        """
        from app.analytics.age_bands import (
            AGE_BANDS, UNKNOWN_DOB_LABEL, bucket_for_age, compute_age_years,
            ordered_bucket_labels,
        )

        # Include ALL active patients (even those with no DOB) so the
        # unknown bucket can be populated.
        q = Patient.query.filter(Patient.is_active == True)
        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status=patient_status)
        if start_date:
            sd = AnalyticsService._parse_datetime(start_date)
            if sd:
                q = q.filter(Patient.created_at >= sd)
        if end_date:
            ed = AnalyticsService._parse_datetime(end_date)
            if ed:
                q = q.filter(Patient.created_at <= ed)
        patients = q.all()

        # Initialize every band at 0 so the chart always shows the full
        # scheme even when a particular band has zero patients.
        buckets: Dict[str, int] = {label: 0 for label in ordered_bucket_labels()}

        today = date.today()
        for patient in patients:
            age = compute_age_years(patient.date_of_birth, today=today)
            label = bucket_for_age(age)
            buckets[label] = buckets.get(label, 0) + 1

        total = sum(buckets.values())

        # Build a lookup so we can attach min/max years to each bucket.
        bounds_by_label = {label: (lo, hi) for label, lo, hi in AGE_BANDS}

        out = []
        for label in ordered_bucket_labels():
            lo, hi = bounds_by_label.get(label, (None, None))
            out.append({
                'range': label,
                'min_age': lo,
                'max_age': hi,  # None for open-ended band (80+) and Unknown
                'count': buckets[label],
                'percentage': round(buckets[label] / total * 100, 1) if total > 0 else 0,
            })
        return out
    
    @staticmethod
    def _get_gender_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None) -> List[Dict]:
        """
        Calculate gender distribution from the patients table.

        Gender values in the database are not case-normalized ("Male" vs
        "male" vs "MALE" all exist), so we collapse them case-insensitively
        using Title case as the canonical form.
        """
        q = db.session.query(
            Patient.gender,
            func.count(Patient.id).label('count')
        ).filter(
            Patient.is_active == True,
            Patient.gender != None,
            Patient.gender != ''
        )
        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status=patient_status, age_group=age_group)
        if start_date:
            sd = AnalyticsService._parse_datetime(start_date)
            if sd:
                q = q.filter(Patient.created_at >= sd)
        if end_date:
            ed = AnalyticsService._parse_datetime(end_date)
            if ed:
                q = q.filter(Patient.created_at <= ed)
        raw = q.group_by(Patient.gender).all()

        buckets: Dict[str, int] = {}
        for row in raw:
            if not row.gender:
                continue
            key = row.gender.strip().title()
            buckets[key] = buckets.get(key, 0) + row.count

        total = sum(buckets.values())
        return [
            {
                'gender': k,
                'count': v,
                'percentage': round(v / total * 100, 1) if total > 0 else 0,
            }
            for k, v in sorted(buckets.items(), key=lambda kv: -kv[1])
        ]
    
    @staticmethod
    def _get_registration_trends(start_date: Optional[str] = None, end_date: Optional[str] = None, months: Optional[int] = None, patient_status: Optional[str] = None) -> List[Dict]:
        """Get patient registration trends over time, using registration_date (falling back to created_at)
        and grouped by age segments to enable multi-line charts."""
        if months is not None:
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=months*30)
        elif not start_date or not end_date:
            # Fallback to last 12 months
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=12*30)
        else:
            start_d = AnalyticsService._parse_datetime(start_date) or datetime.utcnow() - timedelta(days=12*30)
            end_d = AnalyticsService._parse_datetime(end_date) or datetime.utcnow()

        delta = end_d - start_d
        
        # Determine grouping granularity based on selected range
        if delta.days <= 1:
            trunc_unit = 'hour'
            date_format = '%H:00'
        elif delta.days <= 31:
            trunc_unit = 'day'
            date_format = '%Y-%m-%d'
        elif delta.days <= 366:
            trunc_unit = 'month'
            date_format = '%Y-%m'
        else:
            trunc_unit = 'year'
            date_format = '%Y'

        # Query patient IDs and dates to group them in memory strictly using Patient.registration_date (NO created_at)
        query = db.session.query(
            Patient.id,
            Patient.registration_date,
            Patient.date_of_birth
        ).select_from(Patient).filter(
            Patient.is_active == True,
            Patient.registration_date.isnot(None),
            Patient.registration_date >= start_d.date(),
            Patient.registration_date <= end_d.date()
        )
        
        # Apply patient status filter if provided
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status=patient_status)
        
        patients = query.all()
        
        from collections import defaultdict
        grouped = defaultdict(lambda: {
            'child_adolescent': 0,
            'adults': 0,
            'older_adults': 0,
            'unknown': 0,
            'count': 0
        })
        
        today_date = date.today()
        
        for p in patients:
            reg_date = p.registration_date
            if not reg_date:
                continue
            
            # Format bucket key
            if trunc_unit == 'hour':
                dt = datetime.combine(reg_date, datetime.min.time())
                bucket_key = dt.strftime(date_format)
            else:
                bucket_key = reg_date.strftime(date_format)
                
            # Determine age group
            if p.date_of_birth is None:
                age_grp = 'unknown'
            else:
                dob = p.date_of_birth
                # Calculate age in years
                age = today_date.year - dob.year - ((today_date.month, today_date.day) < (dob.month, dob.day))
                if age < 0:
                    age_grp = 'unknown'
                elif age < 19:
                    age_grp = 'child_adolescent'
                elif age < 60:
                    age_grp = 'adults'
                else:
                    age_grp = 'older_adults'
            
            grouped[bucket_key][age_grp] += 1
            grouped[bucket_key]['count'] += 1
            
        sorted_keys = sorted(grouped.keys())
        
        return [
            {
                'month': key,
                'child_adolescent': grouped[key]['child_adolescent'],
                'adults': grouped[key]['adults'],
                'older_adults': grouped[key]['older_adults'],
                'unknown': grouped[key]['unknown'],
                'count': grouped[key]['count']
            }
            for key in sorted_keys
        ]

    @staticmethod
    def get_form_analytics(start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict:
        """
        Get comprehensive form analytics.

        Args:
            start_date: Filter start date (YYYY-MM-DD)
            end_date: Filter end date (YYYY-MM-DD)

        Returns:
            Dictionary with form usage stats, completion metrics, and trends
        """
        # Total forms count
        total_forms = Form.query.filter(Form.is_active == True).count()

        # Total submissions
        total_submissions = FormSubmission.query.count()

        # Get status breakdown
        status_breakdown = AnalyticsService._get_form_status_breakdown()

        # Calculate completion rate
        completed = FormSubmission.query.filter(
            FormSubmission.submission_status == 'submitted'
        ).count()
        completion_rate = (completed / total_submissions * 100) if total_submissions > 0 else 0

        # Get average completion time
        avg_completion_time = AnalyticsService._get_average_completion_time()

        # Get top forms by usage
        top_forms = AnalyticsService._get_top_forms_by_usage(limit=10)

        # Get submission trends
        submission_trends = AnalyticsService._get_form_submission_trends(months=12)

        # Get form completion funnel
        funnel = AnalyticsService._get_form_completion_funnel()

        return {
            'summary': {
                'total_forms': total_forms,
                'total_submissions': total_submissions,
                'average_completion_rate': round(completion_rate, 1),
                'average_completion_time_minutes': avg_completion_time
            },
            'status_breakdown': status_breakdown,
            'top_forms': top_forms,
            'submission_trends': submission_trends,
            'completion_funnel': funnel
        }

    @staticmethod
    def _get_form_status_breakdown() -> List[Dict]:
        """Get breakdown of form submissions by status."""
        result = db.session.query(
            FormSubmission.submission_status,
            func.count(FormSubmission.id).label('count')
        ).group_by(FormSubmission.submission_status).all()

        total = sum(r.count for r in result)
        return [
            {
                'status': r.submission_status or 'unknown',
                'count': r.count,
                'percentage': round(r.count / total * 100, 1) if total > 0 else 0
            }
            for r in result
        ]

    @staticmethod
    def _get_average_completion_time() -> float:
        """Calculate average time to complete forms (in minutes)."""
        # Query submissions that have both started_at and submitted_at
        result = db.session.query(
            func.avg(
                func.extract('epoch', FormSubmission.submitted_at) -
                func.extract('epoch', FormSubmission.started_at)
            ).label('avg_seconds')
        ).filter(
            FormSubmission.started_at != None,
            FormSubmission.submitted_at != None,
            FormSubmission.submission_status == 'submitted'
        ).scalar()

        if result:
            # Convert seconds to minutes
            return round(result / 60, 1)
        return 0

    @staticmethod
    def _get_top_forms_by_usage(limit: int = 10) -> List[Dict]:
        """Get top forms by submission count."""
        result = db.session.query(
            Form.id,
            Form.name,
            func.count(FormSubmission.id).label('submission_count')
        ).outerjoin(
            FormSubmission, Form.id == FormSubmission.form_id
        ).filter(
            Form.is_active == True
        ).group_by(
            Form.id, Form.name
        ).order_by(
            desc('submission_count')
        ).limit(limit).all()

        return [
            {
                'form_id': str(row.id),
                'form_name': row.name,
                'submissions': row.submission_count
            }
            for row in result
        ]

    @staticmethod
    def _get_form_submission_trends(months: int = 12) -> List[Dict]:
        """Get form submission trends over time."""
        # Get start date (X months ago)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months*30)

        # Query grouped by month
        query = db.session.query(
            func.date_trunc('month', FormSubmission.created_at).label('month'),
            func.count(FormSubmission.id).label('count')
        ).filter(
            FormSubmission.created_at >= start_date
        ).group_by(
            func.date_trunc('month', FormSubmission.created_at)
        ).order_by('month')

        result = query.all()

        return [
            {
                'month': row.month.strftime('%Y-%m') if row.month else '',
                'submissions': row.count
            }
            for row in result
        ]

    @staticmethod
    def _get_form_completion_funnel() -> Dict:
        """Get form completion funnel (started -> submitted -> verified)."""
        # Count by status
        draft_count = FormSubmission.query.filter(
            FormSubmission.submission_status == 'draft'
        ).count()

        submitted_count = FormSubmission.query.filter(
            FormSubmission.submission_status.in_(['submitted', 'verified'])
        ).count()

        verified_count = FormSubmission.query.filter(
            FormSubmission.submission_status == 'verified'
        ).count()

        total = FormSubmission.query.count()

        return {
            'started': total,
            'submitted': submitted_count,
            'verified': verified_count,
            'draft': draft_count,
            'submission_rate': round((submitted_count / total * 100), 1) if total > 0 else 0,
            'verification_rate': round((verified_count / total * 100), 1) if total > 0 else 0
        }
        
    @staticmethod
    def _get_complexity_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None):
        """
        Get distribution of patients by clinical complexity.
        """
        sd = AnalyticsService._parse_datetime(start_date)
        ed = AnalyticsService._parse_datetime(end_date)

        q = (
            db.session.query(
                Patient.clinical_complexity,
                func.count(Patient.id).label("count")
            )
            .filter(
                Patient.is_active == True,
                Patient.clinical_complexity.isnot(None)
            )
        )
        if sd:
            q = q.filter(Patient.created_at >= sd)
        if ed:
            q = q.filter(Patient.created_at <= ed)

        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status, age_group)

        result = q.group_by(Patient.clinical_complexity).all()

        labels = {
            "high": "High",
            "medium": "Medium",
            "low": "Low",
            "not_yet_determined": "Not Yet Determined",
        }

        total = sum(r.count for r in result)

        return [
            {
                "name": labels.get(r.clinical_complexity, r.clinical_complexity),
                "count": r.count,
                "percentage": round((r.count / total) * 100, 1) if total else 0,
            }
            for r in result
        ]
        
    @staticmethod
    def _get_bsc_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None):
        """
        Get distribution of patients by BSC and Oncology status.
        """
        sd = AnalyticsService._parse_datetime(start_date)
        ed = AnalyticsService._parse_datetime(end_date)

        q = (
            db.session.query(
                Patient.bsc_status,
                Patient.is_onco,
                func.count(Patient.id).label("count")
            )
            .filter(
                Patient.is_active == True
            )
        )
        if sd:
            q = q.filter(Patient.created_at >= sd)
        if ed:
            q = q.filter(Patient.created_at <= ed)

        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status, age_group)

        result = q.group_by(
            Patient.bsc_status,
            Patient.is_onco
        ).all()

        total = sum(r.count for r in result)

        data = []

        for r in result:
            # Handle unknown values
            if r.bsc_status is None or r.is_onco is None:
                name = "Not Yet Determined"
            else:
                status = "BSC" if r.bsc_status else "Non-BSC"
                disease = "Oncology" if r.is_onco else "Non-Oncology"
                name = f"{status} - {disease}"

            data.append({
                "name": name,
                "count": r.count,
                "percentage": round((r.count / total) * 100, 1) if total else 0,
            })

        return data
    
    @staticmethod
    def _get_home_visits_by_month(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None) -> List[Dict]:
        """
        Get total completed home visits grouped dynamically by timeline.
        """
        if not start_date or not end_date:
            # Fallback to last 12 months
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=12*30)
        else:
            start_d = AnalyticsService._parse_datetime(start_date) or datetime.utcnow() - timedelta(days=12*30)
            end_d = AnalyticsService._parse_datetime(end_date) or datetime.utcnow()

        delta = end_d - start_d
        if delta.days <= 1:
            trunc_unit = 'hour'
            date_format = '%H:00'
        elif delta.days <= 31:
            trunc_unit = 'day'
            date_format = '%Y-%m-%d'
        elif delta.days <= 366:
            trunc_unit = 'month'
            date_format = '%Y-%m'
        else:
            trunc_unit = 'year'
            date_format = '%Y'

        query = (
            db.session.query(
                func.date_trunc(trunc_unit, PatientVisit.visit_date).label('bucket'),
                func.count(PatientVisit.id).label('count')
            )
            .join(Patient, PatientVisit.patient_id == Patient.id)
            .filter(
                PatientVisit.visit_location == 'home',
                PatientVisit.status == 'completed',
                PatientVisit.visit_date >= start_d.date(),
                PatientVisit.visit_date <= end_d.date()
            )
        )
        
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status, age_group)
        
        result = (
            query.group_by(
                func.date_trunc(trunc_unit, PatientVisit.visit_date)
            )
            .order_by('bucket')
            .all()
        )
        
        return [
            {
                "month": r.bucket.strftime(date_format) if r.bucket else "",
                "count": r.count
            }
            for r in result
        ]
        
    @staticmethod
    def _get_visit_type_by_month(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None) -> List[Dict]:
        """
        Get distribution of Initial vs Follow-up visits grouped dynamically.
        """
        if not start_date or not end_date:
            # Fallback to last 12 months
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=12*30)
        else:
            start_d = AnalyticsService._parse_datetime(start_date) or datetime.utcnow() - timedelta(days=12*30)
            end_d = AnalyticsService._parse_datetime(end_date) or datetime.utcnow()

        delta = end_d - start_d
        if delta.days <= 1:
            trunc_unit = 'hour'
            date_format = '%H:00'
        elif delta.days <= 31:
            trunc_unit = 'day'
            date_format = '%Y-%m-%d'
        elif delta.days <= 366:
            trunc_unit = 'month'
            date_format = '%Y-%m'
        else:
            trunc_unit = 'year'
            date_format = '%Y'

        query = (
            db.session.query(
                func.date_trunc(trunc_unit, PatientVisit.visit_date).label('bucket'),
                PatientVisit.visit_type,
                func.count(PatientVisit.id).label("count")
            )
            .join(Patient, PatientVisit.patient_id == Patient.id)
            .filter(
                PatientVisit.status == "completed",
                PatientVisit.visit_date >= start_d.date(),
                PatientVisit.visit_date <= end_d.date()
            )
        )

        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status, age_group)

        result = (
            query.group_by(
                func.date_trunc(trunc_unit, PatientVisit.visit_date),
                PatientVisit.visit_type
            )
            .order_by('bucket')
            .all()
        )

        data = {}
        for row in result:
            bucket_str = row.bucket.strftime(date_format) if row.bucket else ""
            if bucket_str not in data:
                data[bucket_str] = {
                    "month": bucket_str,
                    "initial": 0,
                    "follow_up": 0
                }
            # Normalize key mapping just in case visit_type has different strings
            vt = row.visit_type if row.visit_type in ['initial', 'follow_up'] else 'follow_up'
            data[bucket_str][vt] = data[bucket_str].get(vt, 0) + row.count

        return list(data.values())
    
    @staticmethod
    def _get_average_visits_by_month(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None) -> List[Dict]:
        """
        Get average completed visits per patient grouped dynamically.
        """
        if not start_date or not end_date:
            # Fallback to last 12 months
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=12*30)
        else:
            start_d = AnalyticsService._parse_datetime(start_date) or datetime.utcnow() - timedelta(days=12*30)
            end_d = AnalyticsService._parse_datetime(end_date) or datetime.utcnow()

        delta = end_d - start_d
        if delta.days <= 1:
            trunc_unit = 'hour'
            date_format = '%H:00'
        elif delta.days <= 31:
            trunc_unit = 'day'
            date_format = '%Y-%m-%d'
        elif delta.days <= 366:
            trunc_unit = 'month'
            date_format = '%Y-%m'
        else:
            trunc_unit = 'year'
            date_format = '%Y'

        query = (
            db.session.query(
                func.date_trunc(trunc_unit, PatientVisit.visit_date).label('bucket'),
                func.count(PatientVisit.id).label('total_visits'),
                func.count(func.distinct(PatientVisit.patient_id)).label('patient_count')
            )
            .join(Patient, PatientVisit.patient_id == Patient.id)
            .filter(
                PatientVisit.status == 'completed',
                PatientVisit.visit_date >= start_d.date(),
                PatientVisit.visit_date <= end_d.date()
            )
        )

        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status, age_group)

        result = (
            query.group_by(
                func.date_trunc(trunc_unit, PatientVisit.visit_date)
            )
            .order_by('bucket')
            .all()
        )

        return [
            {
                "month": r.bucket.strftime(date_format) if r.bucket else "",
                "average_visits": round(
                    r.total_visits / r.patient_count, 2
                ) if r.patient_count else 0
            }
            for r in result
        ]
        
    @staticmethod
    def _get_visit_frequency_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None) -> Dict:
        """
        Distribution of patients by completed visit count in the date range.
        """
        if not start_date or not end_date:
            end_d = datetime.utcnow()
            start_d = end_d - timedelta(days=12*30)
        else:
            start_d = AnalyticsService._parse_datetime(start_date) or datetime.utcnow() - timedelta(days=12*30)
            end_d = AnalyticsService._parse_datetime(end_date) or datetime.utcnow()

        visit_filters = [
            Patient.id == PatientVisit.patient_id,
            PatientVisit.status == "completed",
            PatientVisit.visit_date >= start_d.date(),
            PatientVisit.visit_date <= end_d.date()
        ]

        q = db.session.query(
            Patient.id,
            Patient.created_at,
            func.count(PatientVisit.id).label("visit_count")
        ).outerjoin(
            PatientVisit,
            and_(*visit_filters)
        )
        
        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status, age_group)
                
        visit_counts = q.group_by(Patient.id, Patient.created_at).all()

        zero_visits = 0
        one_visit = 0
        two_visits = 0
        three_plus_visits = 0

        for patient in visit_counts:
            if patient.visit_count == 0:
                # Only include patient in "0 Visits" cohort if they registered in this timeframe
                if patient.created_at and start_d <= patient.created_at <= end_d:
                    zero_visits += 1
            elif patient.visit_count == 1:
                one_visit += 1
            elif patient.visit_count == 2:
                two_visits += 1
            else:
                three_plus_visits += 1

        return {
            "zero_visits": zero_visits,
            "one_visit": one_visit,
            "two_visits": two_visits,
            "three_plus_visits": three_plus_visits
        }
        
    @staticmethod
    def _get_average_time_to_first_visit(start_date: Optional[str] = None, end_date: Optional[str] = None, patient_status: Optional[str] = None, age_group: Optional[str] = None, period: str = 'monthly') -> Dict:
        """
        Responsiveness Analysis:
        Cohort-based on Patient Registration Date.
        For patients registered in a given period (e.g. March), calculates the turnaround time
        (gap days) from their registration date to their first visit date.

        Source of truth:
          - patient          -> registration_date and cohort filters
          - patient_visit    -> first contact date, calendar gap calculation
          - daily_vehicle_schedules -> ONLY used to read homecare_days_at_schedule for the
                               ISO week that contains each patient's first visit date.
                               No other DVS data (gap_days_at_visit, schedule_date as
                               first-contact, etc.) is used.
        """
        from app.saranam.models.daily_vehicle_schedule import DailyVehicleSchedule

        # 1. Patients registered in the selected date range
        #    Uses Patient.registration_date strictly (NOT created_at)
        patient_q = db.session.query(
            Patient.id.label("patient_id"),
            Patient.registration_date.label("registration_date")
        ).filter(
            Patient.registration_date.isnot(None)  # include all patients regardless of active/inactive/deceased
        )

        patient_q = AnalyticsService.apply_patient_filters(patient_q, Patient, patient_status, age_group)

        if start_date:
            sd = AnalyticsService._parse_datetime(start_date)
            if sd:
                patient_q = patient_q.filter(Patient.registration_date >= sd.date())
        if end_date:
            ed = AnalyticsService._parse_datetime(end_date)
            if ed:
                patient_q = patient_q.filter(Patient.registration_date <= ed.date())

        patients = patient_q.all()
        if not patients:
            return {"average_days": 0, "calendar_days": 0, "trend": []}

        patient_ids = [p.patient_id for p in patients]

        # 2. SOURCE OF TRUTH: earliest non-cancelled visit per patient from patient_visit
        pv_first = {}  # patient_id -> date
        try:
            pv_recs = db.session.query(
                PatientVisit.patient_id,
                func.min(PatientVisit.visit_date).label("first_visit_date")
            ).filter(
                PatientVisit.patient_id.in_(patient_ids),
                PatientVisit.visit_type == "initial",
                PatientVisit.status == "completed"
            ).group_by(PatientVisit.patient_id).all()

            for r in pv_recs:
                v_date = r.first_visit_date.date() if hasattr(r.first_visit_date, 'date') else r.first_visit_date
                pv_first[r.patient_id] = v_date
        except Exception as ex:
            print(f"Error querying patient_visits for responsiveness: {ex}")

        # 3. DVS lookup: homecare_days_at_schedule for the ISO week of each patient's first visit
        #
        #    ISO week (Monday-Sunday) is used as the scheduling week boundary.
        #    For a first visit on 01-03-2026 (ISO week 9 of 2026), we look for a DVS record
        #    for that patient whose schedule_date also falls in ISO week 9/2026, and read
        #    homecare_days_at_schedule.  If multiple DVS records exist in the same week the
        #    first one encountered is used (all rows in a week carry the same week-level count).
        #
        #    If no DVS record exists for that (patient, week) we fall back to calendar_days.
        dvs_hc_by_patient_week = {}  # (patient_id, iso_year, iso_week) -> float
        try:
            needed_ids = list(pv_first.keys())
            if needed_ids:
                dvs_recs = db.session.query(
                    DailyVehicleSchedule.patient_id,
                    DailyVehicleSchedule.schedule_date,
                    DailyVehicleSchedule.homecare_days_at_schedule
                ).filter(
                    DailyVehicleSchedule.patient_id.in_(needed_ids),
                    DailyVehicleSchedule.status != "cancelled",
                    DailyVehicleSchedule.homecare_days_at_schedule.isnot(None)
                ).all()

                for r in dvs_recs:
                    s_date = r.schedule_date.date() if hasattr(r.schedule_date, 'date') else r.schedule_date
                    iso_yr, iso_wk, _ = s_date.isocalendar()
                    key = (r.patient_id, iso_yr, iso_wk)
                    try:
                        hc_val = float(str(r.homecare_days_at_schedule).strip())
                        if hc_val >= 0:
                            dvs_hc_by_patient_week.setdefault(key, hc_val)
                    except (ValueError, TypeError):
                        pass
        except Exception as ex:
            print(f"Error querying daily_vehicle_schedules for homecare days: {ex}")

        # 4. Aggregate into period buckets keyed by registration date
        import datetime as _dt
        JULY_2026 = _dt.date(2026, 7, 1)  # threshold: pre-July = 4 hc-days/week, post = DVS or 5

        monthly_stats = {}
        total_all_calendar_days = 0.0
        total_all_homecare_days = 0.0
        total_all_visited = 0

        for p in patients:
            reg_d = p.registration_date
            if hasattr(reg_d, 'date'):
                reg_d = reg_d.date()

            first_visit_date = pv_first.get(p.patient_id)  # None if no visits yet

            cal_days = None
            hc_days = None

            if first_visit_date and reg_d:
                # Calendar gap from patient_visit (source of truth)
                cal_days = float(max(0, (first_visit_date - reg_d).days))

                # Homecare days per scheduling week:
                #   < July 2026  → fixed 4 days/week (org operated on a 4-day homecare week)
                #   >= July 2026 → DVS homecare_days_at_schedule for the ISO week of the
                #                  first visit date; fallback = 5 if no DVS record exists
                if first_visit_date < JULY_2026:
                    hc_days = 4.0
                else:
                    iso_yr, iso_wk, _ = first_visit_date.isocalendar()
                    hc_days = dvs_hc_by_patient_week.get((p.patient_id, iso_yr, iso_wk))
                    if hc_days is None:
                        hc_days = 5.0  # fallback when no DVS record for that week

            # Bucket by registration date
            if period == 'yearly':
                bucket_key = reg_d.strftime("%Y") if reg_d else ""
            elif period == 'daily':
                bucket_key = reg_d.strftime("%Y-%m-%d") if reg_d else ""
            else:  # monthly (default)
                bucket_key = reg_d.strftime("%Y-%m") if reg_d else ""

            if bucket_key:
                if bucket_key not in monthly_stats:
                    monthly_stats[bucket_key] = {
                        "total_homecare_days": 0.0,
                        "total_calendar_days": 0.0,
                        "total_registered": 0,
                        "visited_count": 0
                    }
                monthly_stats[bucket_key]["total_registered"] += 1
                if first_visit_date:
                    monthly_stats[bucket_key]["visited_count"] += 1
                    monthly_stats[bucket_key]["total_homecare_days"] += hc_days
                    monthly_stats[bucket_key]["total_calendar_days"] += cal_days
                    total_all_homecare_days += hc_days
                    total_all_calendar_days += cal_days
                    total_all_visited += 1

        # 5. Build trend response
        #    average_days  = avg homecare_days_at_schedule from DVS week (fallback: calendar days)
        #    calendar_days = avg raw calendar days from registration to first visit
        trend = []
        for m_str in sorted(monthly_stats.keys()):
            stats = monthly_stats[m_str]
            visited_cnt = stats["visited_count"]
            trend.append({
                "month": m_str,
                "average_days": round(stats["total_homecare_days"] / visited_cnt, 1) if visited_cnt > 0 else 0,
                "calendar_days": round(stats["total_calendar_days"] / visited_cnt, 1) if visited_cnt > 0 else 0,
                "patient_count": visited_cnt,
                "visited_count": visited_cnt,
                "total_registered": stats["total_registered"]
            })

        overall_average = round(total_all_homecare_days / total_all_visited, 1) if total_all_visited > 0 else 0
        overall_calendar_avg = round(total_all_calendar_days / total_all_visited, 1) if total_all_visited > 0 else 0

        return {
            "average_days": overall_average,
            "calendar_days": overall_calendar_avg,
            "trend": trend
        }