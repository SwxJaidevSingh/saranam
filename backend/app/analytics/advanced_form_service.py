"""Advanced form analytics service for granular field-level tracking and distributions."""
from sqlalchemy import func, case, desc, Float
from datetime import datetime, timedelta
import collections

from app.extensions import db
from app.forms.models import Form
from app.submissions.models import FormSubmission, FormAnswer
import logging

logger = logging.getLogger(__name__)

class AdvancedFormAnalyticsService:
    
    @staticmethod
    def get_form_overview(form_id: str) -> dict:
        """Get high-level statistics for a specific form."""
        total_submissions = db.session.query(func.count(FormSubmission.id)).filter_by(form_id=form_id).scalar() or 0
        
        # Calculate completion rate (submitted vs draft)
        completed_count = db.session.query(func.count(FormSubmission.id)).filter_by(
            form_id=form_id, submission_status='submitted'
        ).scalar() or 0
        
        completion_rate = (completed_count / total_submissions * 100) if total_submissions > 0 else 0
        
        # Calculate average completion time (for submitted forms with started_at and submitted_at)
        avg_time_query = db.session.query(
            func.avg(
                func.extract('epoch', FormSubmission.submitted_at) - func.extract('epoch', FormSubmission.started_at)
            )
        ).filter(
            FormSubmission.form_id == form_id,
            FormSubmission.submission_status == 'submitted',
            FormSubmission.started_at.isnot(None),
            FormSubmission.submitted_at.isnot(None)
        ).scalar()
        
        avg_time_seconds = float(avg_time_query) if avg_time_query else 0
        
        # Simple efficiency score (0-100)
        # Higher completion rate is good, lower avg time (below a threshold) is good
        efficiency_score = 0
        if total_submissions > 0:
            # Base 50% on completion rate
            efficiency_score += (completion_rate * 0.5)
            # Add points if avg time is reasonable (e.g., under 5 mins gets full 50 points)
            if avg_time_seconds > 0:
                time_score = max(0, 50 - (avg_time_seconds / 60) * 2) # Loose approx 2 points per minute
                efficiency_score += time_score
            else:
                efficiency_score += 25 # default middle
                
        # Total fields in the generic schema
        form = db.session.query(Form).filter_by(id=form_id).first()
        total_fields = len(form.get_field_ids()) if form else 0
        
        # Average fields completed per submission
        total_answers_recorded = db.session.query(func.count(FormAnswer.id)).join(
            FormSubmission, FormAnswer.submission_id == FormSubmission.id
        ).filter(FormSubmission.form_id == form_id).scalar() or 0
        
        avg_fields_completed = total_answers_recorded / total_submissions if total_submissions > 0 else 0
        
        return {
            "form_id": form_id,
            "total_submissions": total_submissions,
            "completion_rate": round(completion_rate, 1),
            "abandonment_rate": round(100 - completion_rate, 1),
            "avg_completion_time_seconds": round(avg_time_seconds, 1),
            "avg_fields_completed": round(avg_fields_completed, 1),
            "total_schema_fields": total_fields,
            "efficiency_score": round(min(100, efficiency_score), 1)
        }

    @staticmethod
    def get_field_distribution(form_id: str, field_id: str, field_type: str) -> dict:
        """
        Get value distribution for a specific field based on its type.
        Adapts visualization data structure for the frontend.
        """
        base_query = db.session.query(FormAnswer).join(
            FormSubmission, FormAnswer.submission_id == FormSubmission.id
        ).filter(
            FormSubmission.form_id == form_id,
            FormAnswer.field_id == field_id
        )

        total_answers = base_query.count()
        if total_answers == 0:
            return {"type": field_type, "total": 0, "data": []}

        distribution_data = []

        if field_type in ['select', 'radio', 'checkbox']:
            # Exact Match Aggregation (Categorical)
            results = db.session.query(
                FormAnswer.value_text.label('category'),
                func.count(FormAnswer.id).label('count')
            ).join(
                FormSubmission, FormAnswer.submission_id == FormSubmission.id
            ).filter(
                FormSubmission.form_id == form_id,
                FormAnswer.field_id == field_id,
                FormAnswer.value_text.isnot(None),
                FormAnswer.value_text != ''
            ).group_by(FormAnswer.value_text).order_by(desc('count')).all()
            
            for row in results:
                pct = (row.count / total_answers) * 100
                distribution_data.append({
                    "name": row.category or "Unknown",
                    "value": row.count,
                    "percentage": round(pct, 1)
                })
                
        elif field_type in ['numeric', 'painScale', 'linearScale', 'severityRating']:
            # Histogram/Bucket Aggregation (Quantitative)
            # Fetch all numeric values to bucket them
            results = db.session.query(FormAnswer.value_numeric).join(
                FormSubmission, FormAnswer.submission_id == FormSubmission.id
            ).filter(
                FormSubmission.form_id == form_id,
                FormAnswer.field_id == field_id,
                FormAnswer.value_numeric.isnot(None)
            ).all()
            
            values = [float(r[0]) for r in results if r[0] is not None]
            
            if values:
                # Basic bucketing logic (10 buckets)
                min_val = min(values)
                max_val = max(values)
                
                if min_val == max_val:
                    distribution_data.append({
                        "range": f"Exact {min_val}",
                        "count": len(values)
                    })
                else:
                    if field_type in ['painScale', 'linearScale']:
                        # Use integer buckets 0-10 or 1-5
                        bucket_size = 1
                        current = int(min_val)
                        while current <= int(max_val):
                            count = sum(1 for v in values if int(v) == current)
                            if count > 0:
                                distribution_data.append({
                                    "range": str(current),
                                    "count": count
                                })
                            current += 1
                    else:
                        # Dynamic bucketing
                        bucket_size = (max_val - min_val) / 5
                        for i in range(5):
                            b_start = min_val + (i * bucket_size)
                            b_end = b_start + bucket_size
                            # Include upper bound in last bucket
                            if i == 4:
                                count = sum(1 for v in values if b_start <= v <= b_end)
                                range_label = f"{b_start:.1f} - {b_end:.1f}"
                            else:
                                count = sum(1 for v in values if b_start <= v < b_end)
                                range_label = f"{b_start:.1f} - <{b_end:.1f}"
                            
                            if count > 0:
                                distribution_data.append({
                                    "range": range_label,
                                    "count": count
                                })

        elif field_type == 'symptomChecklist':
             # Deep JSON parsing for complex fields
             # For symptomChecklist, value_json looks like: [{"symptom": "Fever", "severity": "Mild"}, ...]
             results = db.session.query(FormAnswer.value_json).join(
                 FormSubmission, FormAnswer.submission_id == FormSubmission.id
             ).filter(
                 FormSubmission.form_id == form_id,
                 FormAnswer.field_id == field_id,
                 FormAnswer.value_json.isnot(None)
             ).all()

             symptom_counts = collections.defaultdict(int)
             for r in results:
                 json_data = r[0]
                 if isinstance(json_data, list):
                     for item in json_data:
                         if isinstance(item, dict) and 'symptom' in item:
                             symptom_counts[item['symptom']] += 1
                 elif isinstance(json_data, dict):
                     # Handling flat object format if any
                     for key, val in json_data.items():
                         if val: symptom_counts[key] += 1
             
             for name, count in sorted(symptom_counts.items(), key=lambda x: x[1], reverse=True):
                 distribution_data.append({
                     "name": name,
                     "value": count,
                     "percentage": round((count / total_answers) * 100, 1) if total_answers > 0 else 0
                 })

        return {
            "type": field_type,
            "total_answers": total_answers,
            "data": distribution_data
        }

    @staticmethod
    def get_dropoff_funnel(form_id: str) -> dict:
        """
        Approximates drop-off funnel by checking which fields were answered.
        Returns the retention percentage per field.
        """
        form = db.session.query(Form).filter_by(id=form_id).first()
        if not form:
            return {"funnel": [], "total_submissions": 0}
            
        field_ids = form.get_field_ids()
        if not field_ids:
            return {"funnel": [], "total_submissions": 0}
            
        # Build label mapping from schema
        label_map = {}
        schema = form.schema
        if isinstance(schema, dict):
            fields_data = []
            if 'fields' in schema:
                fields_data = schema['fields']
            elif 'pages' in schema and isinstance(schema['pages'], list):
                for page in schema['pages']:
                    elements = page.get('elements', []) or page.get('fields', [])
                    fields_data.extend(elements)
            elif 'sections' in schema and isinstance(schema['sections'], list):
                for section in schema['sections']:
                    fields_data.extend(section.get('fields', []))
            
            for f in fields_data:
                if isinstance(f, dict) and 'id' in f:
                    label_map[f['id']] = f.get('label') or f.get('name') or f['id']

        total_submissions = db.session.query(func.count(FormSubmission.id)).filter_by(form_id=form_id).scalar() or 0
        if total_submissions == 0:
            return {"funnel": [], "total_submissions": 0}

        # Count answers for each field
        answer_counts = db.session.query(
            FormAnswer.field_id,
            func.count(func.distinct(FormAnswer.submission_id)).label('sub_count')
        ).join(
            FormSubmission, FormAnswer.submission_id == FormSubmission.id
        ).filter(
            FormSubmission.form_id == form_id
        ).group_by(FormAnswer.field_id).all()
        
        counts_dict = {row.field_id: row.sub_count for row in answer_counts}
        
        funnel = []
        prev_count = total_submissions
        
        for index, field_id in enumerate(field_ids):
            count = counts_dict.get(field_id, 0)
            completion_rate = (count / total_submissions) * 100 if total_submissions > 0 else 0
            
            dropoff_val = prev_count - count if prev_count > count else 0
            dropoff_pct = (dropoff_val / prev_count) * 100 if prev_count > 0 else 0
            
            funnel.append({
                "field_index": index + 1,
                "field_id": field_id,
                "label": label_map.get(field_id, field_id),
                "answered_count": count,
                "completion_rate": round(completion_rate, 1),
                "dropoff_from_previous": dropoff_val,
                "dropoff_percentage": round(dropoff_pct, 1),
                "is_bottleneck": dropoff_pct > 25  # Arbitrary threshold for MVP
            })
            prev_count = count
            
        return {
            "funnel": funnel,
            "total_submissions": total_submissions
        }

    @staticmethod
    def get_usage_heatmap(form_id: str) -> list:
        """Returns submission counts grouped by Day of Week and Hour of Day."""
        # DOW in Postgres: 0=Sunday, 6=Saturday
        results = db.session.query(
            func.extract('dow', FormSubmission.started_at).label('day_of_week'),
            func.extract('hour', FormSubmission.started_at).label('hour_of_day'),
            func.count(FormSubmission.id).label('count')
        ).filter(
            FormSubmission.form_id == form_id,
            FormSubmission.started_at.isnot(None)
        ).group_by('day_of_week', 'hour_of_day').all()
        
        heatmap = []
        days_map = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'}
        
        for row in results:
            day_num = int(row.day_of_week) if row.day_of_week is not None else -1
            if day_num in days_map:
                heatmap.append({
                    "day": days_map[day_num],
                    "day_index": day_num,
                    "hour": int(row.hour_of_day),
                    "value": row.count
                })
                
        max_intensity = max([item['value'] for item in heatmap]) if heatmap else 0
        
        return {
            "heatmap": heatmap,
            "max_intensity": max_intensity
        }
