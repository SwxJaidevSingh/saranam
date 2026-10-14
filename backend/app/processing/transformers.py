"""
Relational Transformer - Transforms extracted clinical data into ORM objects.

Converts extracted clinical data into SQLAlchemy model instances
ready for database persistence.
"""

from app.submissions.models import FormAnswer
from app.observations.models import Observation
from app.diagnoses.models import Diagnosis


class RelationalTransformer:
    """
    Transforms extracted clinical data into relational ORM objects.

    Takes categorized data from ClinicalExtractor and creates
    appropriate model instances (FormAnswer, Observation, Diagnosis).
    """

    def transform(self, form_schema, raw_data, submission_id, patient_id=None, encounter_id=None):
        """
        Transform raw data into relational objects.

        Args:
            form_schema: dict - Form schema (JSONB)
            raw_data: dict - Raw submission data {field_id: value}
            submission_id: UUID - FormSubmission ID
            patient_id: UUID - Patient ID (optional)
            encounter_id: UUID - Encounter ID (optional)

        Returns:
            dict with lists of ORM objects (not yet committed):
            {
                'form_answers': [FormAnswer, ...],
                'observations': [Observation, ...],
                'diagnoses': [Diagnosis, ...]
            }
        """
        fields = self._get_fields_from_schema(form_schema)
        fields_by_id = {f['id']: f for f in fields}

        form_answers = []
        observations = []
        diagnoses = []

        for field_id, value in raw_data.items():
            if field_id not in fields_by_id:
                continue

            field_config = fields_by_id[field_id]

            # Create FormAnswer for every field
            answer = self._create_form_answer(
                submission_id=submission_id,
                field_id=field_id,
                field_config=field_config,
                value=value
            )
            form_answers.append(answer)

            # Additionally create Observation if it's a vital sign
            observation = self._try_create_observation(
                field_id=field_id,
                field_config=field_config,
                value=value,
                patient_id=patient_id,
                encounter_id=encounter_id
            )
            if observation:
                observations.append(observation)

        return {
            'form_answers': form_answers,
            'observations': observations,
            'diagnoses': diagnoses
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

    def _create_form_answer(self, submission_id, field_id, field_config, value):
        """Create a FormAnswer object from field data."""
        field_type = field_config['type']
        field_label = field_config['label']

        answer = FormAnswer(
            submission_id=submission_id,
            field_id=field_id,
            field_type=field_type,
            field_label=field_label
        )

        # Set appropriate value column based on type
        if field_type in ['number', 'painScale', 'linearScale']:
            answer.value_numeric = float(value) if value is not None else None
        elif field_type == 'date':
            answer.value_date = value
        elif field_type == 'time':
            answer.value_time = value
        elif field_type == 'checkbox':
            answer.value_boolean = bool(value)
        elif field_type in ['select', 'radio']:
            if isinstance(value, list):
                answer.value_json = value  # Multiple selections
            else:
                answer.value_text = str(value)  # Single selection
        else:
            answer.value_text = str(value) if value is not None else None

        # Set clinical mapping if applicable
        observation_type = self._map_to_observation_type(field_id, field_label)
        if observation_type != 'other':
            answer.maps_to_observation_type = observation_type
            answer.loinc_code = self._get_loinc_code(field_id, field_label)

        return answer

    def _try_create_observation(self, field_id, field_config, value, patient_id, encounter_id):
        """Try to create an Observation if field represents a vital sign."""
        if not patient_id:
            return None  # Need patient_id for observations

        field_type = field_config['type']
        field_label = field_config.get('label', '').lower()

        # Check if it's a vital sign or pain scale
        if field_type not in ['number', 'painScale']:
            return None

        observation_type = self._map_to_observation_type(field_id, field_label)

        # Skip if not a recognized vital
        if observation_type == 'other' and field_type != 'painScale':
            return None

        # Create observation
        observation = Observation(
            patient_id=patient_id,
            encounter_id=encounter_id,
            observation_type=observation_type if observation_type != 'other' else 'pain_scale',
            observation_category='vital-signs'
        )

        # Set value
        observation.set_value(value, 'numeric')

        # Set unit
        observation.unit = self._get_unit(field_id, field_label)

        # Set LOINC code
        observation.loinc_code = self._get_loinc_code(field_id, field_label)

        # Set reference ranges if available
        if field_type == 'painScale':
            observation.reference_range_low = 0
            observation.reference_range_high = 10
        elif 'validation' in field_config:
            validation = field_config['validation']
            if 'min' in validation:
                observation.reference_range_low = validation['min']
            if 'max' in validation:
                observation.reference_range_high = validation['max']

        return observation

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
        elif 'pain' in field_combined:
            return 'pain_scale'

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
        elif 'pain' in field_combined:
            return 'score'

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
            'pain': '72514-3',  # Pain severity
        }

        for key, loinc in loinc_map.items():
            if key in field_combined:
                return loinc

        return None
