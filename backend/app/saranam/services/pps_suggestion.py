"""PPS Suggestion Engine — suggests PPS score from other assessment data."""
from uuid import UUID
from typing import Optional

from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
from app.saranam.models.patient_visit import PatientVisit


# PPS reference data for auto-filling component fields
PPS_COMPONENTS = {
    100: {'ambulation': 'Full', 'activity': 'Normal, No Disease', 'self_care': 'Full', 'intake': 'Normal', 'consciousness': 'Full'},
    90:  {'ambulation': 'Full', 'activity': 'Normal, Some Disease', 'self_care': 'Full', 'intake': 'Normal', 'consciousness': 'Full'},
    80:  {'ambulation': 'Full', 'activity': 'Normal with Effort', 'self_care': 'Full', 'intake': 'Normal or Reduced', 'consciousness': 'Full'},
    70:  {'ambulation': 'Reduced', 'activity': "Can't do normal job", 'self_care': 'Full', 'intake': 'Normal or Reduced', 'consciousness': 'Full'},
    60:  {'ambulation': 'Reduced', 'activity': "Can't do hobbies/housework", 'self_care': 'Occasional Assistance', 'intake': 'Normal or Reduced', 'consciousness': 'Full or Confusion'},
    50:  {'ambulation': 'Mainly Sit/Lie', 'activity': "Can't do any work", 'self_care': 'Considerable Assistance', 'intake': 'Normal or Reduced', 'consciousness': 'Full or Confusion'},
    40:  {'ambulation': 'Mainly in Bed', 'activity': 'As above', 'self_care': 'Mainly Assistance', 'intake': 'Normal or Reduced', 'consciousness': 'Full or Drowsy/Confusion'},
    30:  {'ambulation': 'Bed Bound', 'activity': 'As above', 'self_care': 'Total Care', 'intake': 'Reduced', 'consciousness': 'Full or Drowsy/Confusion'},
    20:  {'ambulation': 'Bed Bound', 'activity': 'As above', 'self_care': 'Total Care', 'intake': 'Minimal', 'consciousness': 'As above'},
    10:  {'ambulation': 'Bed Bound', 'activity': 'As above', 'self_care': 'Total Care', 'intake': 'Mouth Care Only', 'consciousness': 'Drowsy or Coma'},
    0:   {'ambulation': 'Death', 'activity': '-', 'self_care': '-', 'intake': '-', 'consciousness': '-'},
}


class PPSSuggestionEngine:
    """Analyzes nursing, doctor, ESAS, and physiotherapy assessments to suggest a PPS score."""

    @staticmethod
    def suggest(visit_id: UUID) -> dict:
        """
        Analyze all available assessments for a visit and suggest a PPS score.

        Returns:
            {
                'suggested_score': int (0-100, multiples of 10),
                'confidence': str ('high', 'medium', 'low'),
                'reasoning': [list of reason strings],
                'components': {ambulation, activity, self_care, intake, consciousness},
                'data_sources': [list of which assessments were available],
            }
        """
        visit = PatientVisit.query.get(visit_id)
        if not visit:
            return {'error': 'Visit not found'}

        nursing = NursingAssessment.query.filter_by(visit_id=visit_id).first()
        doctor = DoctorAssessment.query.filter_by(visit_id=visit_id).first()
        esas = EsasScore.query.filter_by(visit_id=visit_id).first()
        physio = PhysiotherapyAssessment.query.filter_by(visit_id=visit_id).first()

        data_sources = []
        if nursing: data_sources.append('nursing')
        if doctor: data_sources.append('doctor')
        if esas: data_sources.append('esas')
        if physio: data_sources.append('physiotherapy')

        if not data_sources:
            return {
                'suggested_score': None,
                'confidence': 'none',
                'reasoning': ['No assessment data available. Fill in at least one assessment (Nursing, Doctor, ESAS-R, or Physiotherapy) to get a PPS suggestion.'],
                'components': {},
                'data_sources': [],
            }

        # ── Score each PPS dimension independently ──
        ambulation_score = PPSSuggestionEngine._assess_ambulation(nursing, physio)
        activity_score = PPSSuggestionEngine._assess_activity(nursing, physio, esas)
        self_care_score = PPSSuggestionEngine._assess_self_care(nursing)
        intake_score = PPSSuggestionEngine._assess_intake(doctor, esas)
        consciousness_score = PPSSuggestionEngine._assess_consciousness(nursing)

        reasoning = []
        dimension_scores = []

        # Ambulation (weight: high)
        if ambulation_score is not None:
            dimension_scores.append(ambulation_score)
            reasoning.append(f"Ambulation → PPS ~{ambulation_score}: {PPSSuggestionEngine._ambulation_reason(nursing, physio)}")

        # Activity (weight: medium)
        if activity_score is not None:
            dimension_scores.append(activity_score)
            reasoning.append(f"Activity → PPS ~{activity_score}: {PPSSuggestionEngine._activity_reason(nursing, esas)}")

        # Self-care (weight: high)
        if self_care_score is not None:
            dimension_scores.append(self_care_score)
            reasoning.append(f"Self-Care → PPS ~{self_care_score}: {PPSSuggestionEngine._self_care_reason(nursing)}")

        # Intake (weight: medium)
        if intake_score is not None:
            dimension_scores.append(intake_score)
            reasoning.append(f"Intake → PPS ~{intake_score}: {PPSSuggestionEngine._intake_reason(doctor, esas)}")

        # Consciousness (weight: critical — overrides if low)
        if consciousness_score is not None:
            dimension_scores.append(consciousness_score)
            reasoning.append(f"Consciousness → PPS ~{consciousness_score}: {PPSSuggestionEngine._consciousness_reason(nursing)}")

        if not dimension_scores:
            return {
                'suggested_score': 70,
                'confidence': 'low',
                'reasoning': ['Insufficient specific data to determine PPS. Defaulting to PPS 70 (reduced ambulation). Please fill in more assessment details.'],
                'components': PPS_COMPONENTS[70],
                'data_sources': data_sources,
            }

        # ── Calculate final score ──
        # Use the MINIMUM of all dimensions (PPS is limited by the worst dimension)
        # But weight consciousness heavily — if unconscious, PPS cannot be > 10
        raw_score = min(dimension_scores)

        # Round to nearest 10
        suggested = max(0, min(100, round(raw_score / 10) * 10))

        # Confidence based on how many data sources we have
        if len(data_sources) >= 3:
            confidence = 'high'
        elif len(data_sources) >= 2:
            confidence = 'medium'
        else:
            confidence = 'low'

        # Add overall summary
        reasoning.insert(0, f"Based on {len(data_sources)} assessment(s): {', '.join(data_sources)}. Taking minimum across all dimensions.")

        return {
            'suggested_score': suggested,
            'confidence': confidence,
            'reasoning': reasoning,
            'components': PPS_COMPONENTS.get(suggested, {}),
            'data_sources': data_sources,
        }

    # ── Dimension assessors ──────────────────────────────────────────────

    @staticmethod
    def _assess_ambulation(nursing, physio) -> Optional[int]:
        """Assess ambulation from nursing ADL and physio functional status."""
        if not nursing and not physio:
            return None

        score = 70  # default: reduced

        if nursing:
            adl = (nursing.adl or '').lower()
            if 'bedridden' in adl or 'bed' in adl:
                score = min(score, 30)
            elif 'support' in adl:
                score = min(score, 50)
            elif 'independent' in adl:
                score = max(score, 80)

        if physio:
            func = (physio.exam_functional_status or '').lower()
            if 'bed bound' in func or 'bedridden' in func or 'immobile' in func:
                score = min(score, 20)
            elif 'wheelchair' in func or 'mainly sit' in func:
                score = min(score, 50)
            elif 'difficulty' in func or 'limited' in func:
                score = min(score, 60)

        return score

    @staticmethod
    def _assess_activity(nursing, physio, esas) -> Optional[int]:
        """Assess activity level from ESAS tiredness/wellbeing and nursing ADL."""
        if not esas and not nursing:
            return None

        score = 70

        if esas:
            tiredness = esas.tiredness or 0
            wellbeing = esas.wellbeing or 0
            avg_burden = (tiredness + wellbeing) / 2

            if avg_burden >= 8:
                score = min(score, 30)
            elif avg_burden >= 6:
                score = min(score, 50)
            elif avg_burden >= 4:
                score = min(score, 60)
            else:
                score = max(score, 80)

        return score

    @staticmethod
    def _assess_self_care(nursing) -> Optional[int]:
        """Assess self-care from nursing ADL and hygiene."""
        if not nursing:
            return None

        adl = (nursing.adl or '').lower()
        hygiene = (nursing.hygiene_general or '').lower()

        if 'bedridden' in adl or 'bed' in adl:
            return 30  # Total care
        elif 'support' in adl:
            if hygiene == 'poor':
                return 40  # Mainly assistance
            return 50  # Considerable assistance
        elif 'independent' in adl:
            if hygiene == 'poor':
                return 60  # Occasional assistance
            return 80  # Full self-care
        return 70

    @staticmethod
    def _assess_intake(doctor, esas) -> Optional[int]:
        """Assess intake from doctor appetite and ESAS appetite score."""
        if not doctor and not esas:
            return None

        score = 70

        if doctor:
            appetite = (doctor.appetite or '').lower()
            if 'absent' in appetite or 'nil' in appetite or 'none' in appetite:
                score = min(score, 20)
            elif 'decreased' in appetite or 'reduced' in appetite or 'poor' in appetite:
                score = min(score, 50)
            elif 'normal' in appetite or 'good' in appetite:
                score = max(score, 80)

        if esas:
            appetite_score = esas.appetite or 0
            if appetite_score >= 9:
                score = min(score, 20)  # Mouth care only
            elif appetite_score >= 7:
                score = min(score, 30)  # Reduced
            elif appetite_score >= 5:
                score = min(score, 50)  # Normal or reduced
            elif appetite_score <= 2:
                score = max(score, 80)  # Normal

        return score

    @staticmethod
    def _assess_consciousness(nursing) -> Optional[int]:
        """Assess consciousness — this is a critical override."""
        if not nursing:
            return None

        consciousness = (nursing.consciousness or '').lower()
        orientation = (nursing.orientation or '').lower()

        if 'unconscious' in consciousness:
            return 10  # Drowsy or coma
        elif 'semi' in consciousness:
            return 30  # Drowsy/confusion
        elif 'disoriented' in orientation or 'confused' in orientation:
            return 50  # Full or confusion
        elif 'agitated' in orientation or 'restless' in orientation:
            return 50
        elif 'conscious' in consciousness and ('oriented' in orientation or not orientation):
            return 100  # Full consciousness — does not limit PPS

        return 80

    # ── Reason generators ────────────────────────────────────────────────

    @staticmethod
    def _ambulation_reason(nursing, physio):
        parts = []
        if nursing and nursing.adl:
            parts.append(f"ADL: {nursing.adl}")
        if physio and physio.exam_functional_status:
            parts.append(f"Functional: {physio.exam_functional_status[:50]}")
        return ', '.join(parts) or 'No specific data'

    @staticmethod
    def _activity_reason(nursing, esas):
        parts = []
        if esas:
            parts.append(f"ESAS tiredness: {esas.tiredness or 0}/10, wellbeing: {esas.wellbeing or 0}/10")
        if nursing and nursing.adl:
            parts.append(f"ADL: {nursing.adl}")
        return ', '.join(parts) or 'No specific data'

    @staticmethod
    def _self_care_reason(nursing):
        parts = []
        if nursing:
            if nursing.adl:
                parts.append(f"ADL: {nursing.adl}")
            if nursing.hygiene_general:
                parts.append(f"Hygiene: {nursing.hygiene_general}")
        return ', '.join(parts) or 'No specific data'

    @staticmethod
    def _intake_reason(doctor, esas):
        parts = []
        if doctor and doctor.appetite:
            parts.append(f"Appetite: {doctor.appetite}")
        if esas and esas.appetite is not None:
            parts.append(f"ESAS appetite: {esas.appetite}/10")
        return ', '.join(parts) or 'No specific data'

    @staticmethod
    def _consciousness_reason(nursing):
        parts = []
        if nursing:
            if nursing.consciousness:
                parts.append(f"State: {nursing.consciousness}")
            if nursing.orientation:
                parts.append(f"Orientation: {nursing.orientation}")
        return ', '.join(parts) or 'No specific data'
