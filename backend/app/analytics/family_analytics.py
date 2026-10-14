import logging
import re
from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient

logger = logging.getLogger(__name__)

COMMON_RELATIONSHIPS = [
    'daughter-in-law', 'daughter in law',
    'son-in-law', 'son in law',
    'mother-in-law', 'mother in law',
    'father-in-law', 'father in law',
    'brother-in-law', 'brother in law',
    'sister-in-law', 'sister in law',
    'daughter', 'son', 'wife', 'husband', 'mother', 'father',
    'brother', 'sister', 'grandmother', 'grandfather', 'aunt', 'uncle',
    'cousin', 'nephew', 'niece', 'spouse', 'partner', 'parent', 'child',
    'sibling', 'friend', 'neighbor', 'neighbour', 'caregiver'
]

def standardize_relationship(rel_str: str) -> str:
    if not rel_str:
        return ""
    
    # 1. Clean the string
    rel_clean = rel_str.strip().lower()
    
    # 2. Check if there are parentheses (e.g. "Rashmi (mother)") and extract content
    match = re.search(r'\(([^)]+)\)', rel_clean)
    if match:
        inner = match.group(1).strip()
        # See if the inner part matches/contains a common relationship
        for r in COMMON_RELATIONSHIPS:
            if r in inner:
                return r.replace(' in law', '-in-law').capitalize()

    # 3. Check the entire string for common relationships
    for r in COMMON_RELATIONSHIPS:
        if r in rel_clean:
            return r.replace(' in law', '-in-law').capitalize()
            
    # 4. Fallback: if no match, clean and return the original string (without parentheses)
    fallback = re.sub(r'\(.*?\)', '', rel_str).strip()
    return fallback.capitalize()

class FamilyAnalyticsService:
    @staticmethod
    def get_beneficiary_stats(start: date, end: date, living_status: Optional[str] = None, patient_status: Optional[str] = None, period: str = 'monthly') -> dict:
        """
        Calculates patient + family member beneficiary metrics.
        - growth_timeline: monthly additions of patients vs. total beneficiaries.
        - relationships: breakdown of family member relationship types.
        - conditions: count of chronic illnesses tagged on genogram nodes.
        - gender_distribution: family member gender ratio.
        - age_distribution: family member age distribution.
        """
        # Query all active patients registered in the window
        query = (
            db.session.query(
                func.coalesce(Patient.registration_date, func.cast(Patient.created_at, db.Date)).label("reg_date"),
                Patient.family_chart,
                Patient.genogram
            )
            .filter(Patient.is_active == True)
            .filter(func.coalesce(Patient.registration_date, func.cast(Patient.created_at, db.Date)) >= start)
            .filter(func.coalesce(Patient.registration_date, func.cast(Patient.created_at, db.Date)) <= end)
        )
        
        from app.analytics.services import AnalyticsService
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status=patient_status)
        
        rows = query.all()
        
        from collections import defaultdict
        # Group additions by month/period
        timeline_buckets = defaultdict(lambda: {
            'new_patients': 0,
            'new_dependents': 0,
            'total_beneficiaries': 0
        })
        
        relationships = defaultdict(int)
        conditions_count = defaultdict(int)
        family_genders = defaultdict(int)
        family_ages = {
            'child_adolescent': 0, # <19
            'adults': 0,           # 19-59
            'older_adults': 0,     # >=60
            'unknown': 0
        }
        
        total_patients = 0
        total_dependents = 0
        
        for reg_date, family_chart, genogram in rows:
            if not reg_date:
                continue
                
            # Date formatting
            if period == 'yearly':
                bucket_key = reg_date.strftime('%Y')
            elif period == 'daily':
                bucket_key = reg_date.strftime('%Y-%m-%d')
            else:
                bucket_key = reg_date.strftime('%Y-%m')
            
            # Count dependents for this patient
            dep_count = 0
            family_members_data = [] # List of parsed family dicts: {age, gender, relationship, conditions}
            
            # If living_status filter is active (yes or no), only count family_chart rows matching it
            if living_status in ['yes', 'no']:
                if family_chart and isinstance(family_chart, list):
                    for row in family_chart:
                        if not isinstance(row, dict):
                            continue
                        if row.get('living_with_patient') == living_status:
                            dep_count += 1
                            family_members_data.append({
                                'age': row.get('age'),
                                'gender': None,
                                'relationship': row.get('relationship'),
                                'conditions': []
                            })
            else:
                # Normal logic (Genogram first, else Family Chart)
                # 1. Check if Genogram is an uploaded image and has manualBeneficiaryCount
                has_genogram = False
                if genogram and isinstance(genogram, dict) and genogram.get('useUploadedImage'):
                    has_genogram = True
                    manual_count = genogram.get('manualBeneficiaryCount')
                    if manual_count is not None:
                        try:
                            # dep_count is total beneficiaries minus 1 (the patient themselves)
                            dep_count = max(0, int(manual_count) - 1)
                        except (ValueError, TypeError):
                            dep_count = 0

                # 2. Parse Genogram first if available (interactive mode)
                if not has_genogram and genogram and isinstance(genogram, dict) and 'nodes' in genogram:
                    nodes = genogram['nodes']
                    if isinstance(nodes, list) and len(nodes) > 0:
                        has_genogram = True
                        custom_count = genogram.get('customBeneficiaryCount')
                        use_custom = False
                        if custom_count is not None and custom_count != '':
                            try:
                                dep_count = max(0, int(custom_count) - 1)
                                use_custom = True
                            except (ValueError, TypeError):
                                pass

                        has_explicit_beneficiaries = any(
                            node.get('isBeneficiary') is True for node in nodes if isinstance(node, dict)
                        )
                        for node in nodes:
                            if not isinstance(node, dict):
                                continue
                            # Index patient (proband) is not counted as a family dependent
                            if node.get('isProband'):
                                continue
                                
                            if has_explicit_beneficiaries and not node.get('isBeneficiary'):
                                continue

                            if not use_custom:
                                dep_count += 1
                            
                            # Gather metadata
                            age_val = node.get('age')
                            gender = node.get('gender')
                            rel = node.get('label') # In genogram, label is often relationship or name
                            conds = node.get('conditions') or []
                            
                            family_members_data.append({
                                'age': age_val,
                                'gender': gender,
                                'relationship': rel,
                                'conditions': conds
                            })
                
                # 3. Fall back to family_chart if genogram was empty/absent
                if not has_genogram and family_chart and isinstance(family_chart, list):
                    for row in family_chart:
                        if not isinstance(row, dict):
                            continue
                        dep_count += 1
                        family_members_data.append({
                            'age': row.get('age'),
                            'gender': None, # family_chart doesn't store gender explicitly
                            'relationship': row.get('relationship'),
                            'conditions': []
                        })
            
            # Aggregate to timeline
            timeline_buckets[bucket_key]['new_patients'] += 1
            timeline_buckets[bucket_key]['new_dependents'] += dep_count
            timeline_buckets[bucket_key]['total_beneficiaries'] += (1 + dep_count)
            
            total_patients += 1
            total_dependents += dep_count
            
            # Aggregate family metadata
            for fm in family_members_data:
                # Relationship mapping/standardization
                rel = standardize_relationship(fm['relationship'])
                if rel:
                    relationships[rel] += 1
                
                # Conditions mapping
                for c in fm['conditions']:
                    if c:
                        # Capitalize condition keys nicely for UI labels
                        c_label = c.replace('_', ' ').capitalize()
                        conditions_count[c_label] += 1
                        
                # Gender mapping
                g = (fm['gender'] or '').strip().capitalize()
                if g in ['Male', 'Female', 'Other']:
                    family_genders[g] += 1
                else:
                    family_genders['Unknown'] += 1
                    
                # Age mapping
                age_str = fm['age']
                try:
                    if age_str is not None and age_str != '':
                        age = int(age_str)
                        if age < 0:
                            family_ages['unknown'] += 1
                        elif age < 19:
                            family_ages['child_adolescent'] += 1
                        elif age < 60:
                            family_ages['adults'] += 1
                        else:
                            family_ages['older_adults'] += 1
                    else:
                        family_ages['unknown'] += 1
                except (ValueError, TypeError):
                    family_ages['unknown'] += 1

        # Format timeline list sorted by month key
        timeline_list = []
        for k in sorted(timeline_buckets.keys()):
            timeline_list.append({
                'month': k,
                'new_patients': timeline_buckets[k]['new_patients'],
                'new_dependents': timeline_buckets[k]['new_dependents'],
                'total_beneficiaries': timeline_buckets[k]['total_beneficiaries']
            })
            
        return {
            'total_patients': total_patients,
            'total_dependents': total_dependents,
            'total_beneficiaries': total_patients + total_dependents,
            'timeline': timeline_list,
            'relationships': [{'name': k, 'value': v} for k, v in relationships.items()],
            'conditions': [{'name': k, 'value': v} for k, v in conditions_count.items()],
            'gender_distribution': [{'name': k, 'value': v} for k, v in family_genders.items()],
            'age_distribution': [{'cohort': k, 'count': v} for k, v in family_ages.items()]
        }
