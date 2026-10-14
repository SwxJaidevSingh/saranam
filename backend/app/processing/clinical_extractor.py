"""
Clinical Extractor - Extracts clinical semantics from form data.

Maps form fields to clinical concepts (demographics, vitals, diagnoses).
This is intelligent processing that understands healthcare context.
"""


class ClinicalExtractor:
    """
    Intelligent extractor that understands clinical context from forms.

    Identifies demographic data, vital signs, pain scales, and diagnoses
    based on field IDs and labels.
    """

    # Field mapping rules - Add more as needed
    DEMOGRAPHIC_FIELDS = {
        'patient_name', 'full_name', 'name', 'patient_full_name',
        'date_of_birth', 'dob', 'birth_date',
        'gender', 'sex',
        'abha_id', 'abha_address', 'health_id',
        'phone', 'mobile', 'contact_number',
        'email', 'email_address',
        'address', 'residential_address'
    }

    VITAL_FIELDS = {
        'blood_pressure_systolic', 'bp_systolic', 'systolic_bp', 'sbp',
        'blood_pressure_diastolic', 'bp_diastolic', 'diastolic_bp', 'dbp',
        'heart_rate', 'pulse', 'pulse_rate', 'hr',
        'temperature', 'body_temperature', 'temp', 'body_temp',
        'weight', 'body_weight', 'wt',
        'height', 'body_height', 'ht',
        'spo2', 'oxygen_saturation', 'o2_sat',
        'respiratory_rate', 'respiration_rate', 'rr', 'breathing_rate'
    }

    PAIN_FIELDS = {
        'pain_scale', 'pain_level', 'pain_score',
        'pain_rating', 'current_pain', 'pain_intensity'
    }

    DIAGNOSIS_FIELDS = {
        'diagnosis', 'primary_diagnosis', 'provisional_diagnosis',
        'secondary_diagnosis', 'differential_diagnosis',
        'icd10_code', 'snomed_code', 'condition'
    }

    def extract(self, form_schema, raw_data):
        """
        Extract clinical data from raw form submission.

        Args:
            form_schema: dict - Form schema (JSONB)
            raw_data: dict - Raw submission data {field_id: value}

        Returns:
            dict with categorized clinical data
        """
        result = {
            'demographics': {},
            'vitals': [],
            'pain': None,
            'diagnoses': [],
            'generic_answers': []
        }

        # Get field definitions from schema
        fields = self._get_fields_from_schema(form_schema)
        fields_by_id = {f['id']: f for f in fields}

        for field_id, value in raw_data.items():
            if field_id not in fields_by_id:
                continue

            field_config = fields_by_id[field_id]
            field_type = field_config['type']
            field_label = field_config.get('label', '').lower()

            # Check if field has explicit clinical mapping
            clinical_mapping = field_config.get('clinicalMapping', {})

            # Priority 1: Use explicit clinicalMapping if present
            if clinical_mapping:
                observation_type = clinical_mapping.get('observationType')
                category = clinical_mapping.get('category', '')

                if category == 'vital-signs' or observation_type in self._vital_observation_types():
                    result['vitals'].append({
                        'field_id': field_id,
                        'observation_type': observation_type,
                        'value': value,
                        'unit': clinical_mapping.get('unit'),
                        'loinc_code': clinical_mapping.get('loincCode')
                    })
                elif observation_type == 'pain_scale' or category == 'survey':
                    result['pain'] = {
                        'field_id': field_id,
                        'observation_type': observation_type or 'pain_scale',
                        'value': value,
                        'unit': clinical_mapping.get('unit', 'score'),
                        'loinc_code': clinical_mapping.get('loincCode', '72514-3')
                    }
                else:
                    # Generic observation with clinical mapping
                    result['vitals'].append({
                        'field_id': field_id,
                        'observation_type': observation_type,
                        'value': value,
                        'unit': clinical_mapping.get('unit'),
                        'loinc_code': clinical_mapping.get('loincCode')
                    })

            # Priority 2: Heuristic detection (fallback)
            # Extract demographics
            elif self._is_demographic_field(field_id, field_label):
                result['demographics'][field_id] = {
                    'field_id': field_id,
                    'label': field_config['label'],
                    'value': value,
                    'category': self._categorize_demographic(field_id, field_label)
                }

            # Extract vitals
            elif self._is_vital_field(field_id, field_label, field_type):
                result['vitals'].append({
                    'field_id': field_id,
                    'observation_type': self._map_to_observation_type(field_id, field_label),
                    'value': value,
                    'unit': self._get_unit(field_id, field_label),
                    'loinc_code': self._get_loinc_code(field_id, field_label)
                })

            # Extract pain scale
            elif field_type == 'painScale' or self._is_pain_field(field_id, field_label):
                result['pain'] = {
                    'field_id': field_id,
                    'observation_type': 'pain_scale',
                    'value': value,
                    'unit': 'score',
                    'loinc_code': '72514-3'  # Pain severity Wong-Baker FACES
                }

            # Extract diagnoses
            elif self._is_diagnosis_field(field_id, field_label):
                result['diagnoses'].append({
                    'field_id': field_id,
                    'diagnosis_text': value,
                    'diagnosis_type': 'provisional'
                })

            # All other fields
            else:
                result['generic_answers'].append({
                    'field_id': field_id,
                    'field_type': field_type,
                    'field_label': field_config['label'],
                    'value': value
                })

        return result

    def _vital_observation_types(self):
        """Return set of known vital observation types."""
        return {
            'bp_systolic', 'bp_diastolic', 'heart_rate', 'respiratory_rate',
            'temperature', 'spo2', 'weight', 'height', 'bmi'
        }

    def _get_fields_from_schema(self, schema):
        """Extract all fields from schema (handles both single-page and multi-page)."""
        if 'fields' in schema:
            return schema['fields']
        elif 'pages' in schema:
            all_fields = []
            for page in schema['pages']:
                all_fields.extend(page.get('fields', []))
            return all_fields
        return []

    def _is_demographic_field(self, field_id, field_label):
        """Check if field represents demographic data."""
        field_id_lower = field_id.lower()
        return (
            any(demo in field_id_lower for demo in self.DEMOGRAPHIC_FIELDS) or
            any(demo in field_label for demo in self.DEMOGRAPHIC_FIELDS)
        )

    def _categorize_demographic(self, field_id, field_label):
        """Categorize demographic field type."""
        combined = (field_id + '_' + field_label).lower()

        if 'name' in combined:
            return 'name'
        elif 'dob' in combined or 'birth' in combined:
            return 'date_of_birth'
        elif 'gender' in combined or 'sex' in combined:
            return 'gender'
        elif 'abha' in combined or 'health_id' in combined:
            return 'abha_id'
        elif 'phone' in combined or 'mobile' in combined:
            return 'contact'
        elif 'email' in combined:
            return 'email'
        elif 'address' in combined:
            return 'address'

        return 'other'

    def _is_vital_field(self, field_id, field_label, field_type):
        """Check if field represents a vital sign."""
        if field_type not in ['number', 'text']:
            return False

        field_id_lower = field_id.lower()
        return (
            any(vital in field_id_lower for vital in self.VITAL_FIELDS) or
            any(vital in field_label for vital in self.VITAL_FIELDS)
        )

    def _is_pain_field(self, field_id, field_label):
        """Check if field represents pain scale."""
        field_id_lower = field_id.lower()
        return (
            any(pain in field_id_lower for pain in self.PAIN_FIELDS) or
            any(pain in field_label for pain in self.PAIN_FIELDS)
        )

    def _is_diagnosis_field(self, field_id, field_label):
        """Check if field represents a diagnosis."""
        field_id_lower = field_id.lower()
        return (
            any(diag in field_id_lower for diag in self.DIAGNOSIS_FIELDS) or
            any(diag in field_label for diag in self.DIAGNOSIS_FIELDS)
        )

    def _map_to_observation_type(self, field_id, field_label):
        """Map field to standardized observation type."""
        field_combined = (field_id + '_' + field_label).lower()

        if 'systolic' in field_combined or 'sbp' in field_combined:
            return 'bp_systolic'
        elif 'diastolic' in field_combined or 'dbp' in field_combined:
            return 'bp_diastolic'
        elif 'temperature' in field_combined or 'temp' in field_combined:
            return 'body_temperature'
        elif 'weight' in field_combined or 'wt' in field_combined:
            return 'body_weight'
        elif 'height' in field_combined or 'ht' in field_combined:
            return 'body_height'
        elif 'pulse' in field_combined or 'heart_rate' in field_combined or 'hr' in field_combined:
            return 'heart_rate'
        elif 'spo2' in field_combined or 'oxygen' in field_combined:
            return 'oxygen_saturation'
        elif 'respiratory' in field_combined or 'breathing' in field_combined or 'rr' in field_combined:
            return 'respiratory_rate'

        return 'other'

    def _get_unit(self, field_id, field_label):
        """Get appropriate unit for measurement."""
        field_combined = (field_id + '_' + field_label).lower()

        if 'blood_pressure' in field_combined or 'bp' in field_combined or 'systolic' in field_combined or 'diastolic' in field_combined:
            return 'mmHg'
        elif 'temperature' in field_combined or 'temp' in field_combined:
            return 'celsius'
        elif 'weight' in field_combined:
            return 'kg'
        elif 'height' in field_combined:
            return 'cm'
        elif 'heart_rate' in field_combined or 'pulse' in field_combined:
            return 'bpm'
        elif 'spo2' in field_combined or 'oxygen' in field_combined:
            return '%'
        elif 'respiratory' in field_combined or 'breathing' in field_combined:
            return 'breaths/min'

        return None

    def _get_loinc_code(self, field_id, field_label):
        """Get LOINC code for common observations."""
        field_combined = (field_id + '_' + field_label).lower()

        # Common LOINC codes
        loinc_map = {
            'systolic': '8480-6',  # Systolic blood pressure
            'diastolic': '8462-4',  # Diastolic blood pressure
            'temperature': '8310-5',  # Body temperature
            'weight': '29463-7',  # Body weight
            'height': '8302-2',  # Body height
            'heart_rate': '8867-4',  # Heart rate
            'pulse': '8867-4',  # Heart rate (pulse)
            'spo2': '59408-5',  # Oxygen saturation
            'respiratory': '9279-1',  # Respiratory rate
        }

        for key, loinc in loinc_map.items():
            if key in field_combined:
                return loinc

        return None
