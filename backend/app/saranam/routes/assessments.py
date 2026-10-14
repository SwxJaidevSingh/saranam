"""Assessment routes — generic CRUD for all assessment types."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID

from app.saranam import saranam_bp
from app.saranam.services.assessment_service import AssessmentService


@saranam_bp.route('/visits/<uuid:visit_id>/assessments', methods=['GET'])
@jwt_required()
def get_all_assessments(visit_id):
    """Get all assessment statuses for a visit."""
    try:
        statuses = AssessmentService.get_all_assessments_for_visit(visit_id)
        return jsonify(statuses), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/visits/<uuid:visit_id>/<assessment_type>', methods=['GET'])
@jwt_required()
def get_assessment(visit_id, assessment_type):
    """Get a specific assessment for a visit."""
    try:
        data = AssessmentService.get_assessment(visit_id, assessment_type)
        return jsonify(data), 200  # Returns null if no assessment exists yet
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/visits/<uuid:visit_id>/<assessment_type>', methods=['POST', 'PUT'])
@jwt_required()
def save_assessment(visit_id, assessment_type):
    """Create or update an assessment for a visit (upsert)."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        result = AssessmentService.save_assessment(
            visit_id=visit_id,
            assessment_type=assessment_type,
            data=data,
            user_id=UUID(current_user_id),
        )

        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/visits/<uuid:visit_id>/<assessment_type>/summary', methods=['POST'])
@jwt_required()
def generate_assessment_summary(visit_id, assessment_type):
    """Generate an AI clinical summary for a single assessment row.

    Does NOT persist. The frontend lets the clinician edit the returned text
    and then saves it via the standard save endpoint into the `ai_summary`
    column.
    """
    try:
        from app.ai.assessment_summary import summarize_assessment
        text, model = summarize_assessment(visit_id, assessment_type)
        return jsonify({'summary': text, 'model': model}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI summary generation failed: {e}'}), 502


@saranam_bp.route('/visits/<uuid:visit_id>/pps/suggest', methods=['GET'])
@jwt_required()
def suggest_pps(visit_id):
    """Suggest PPS score based on other assessment data for this visit."""
    try:
        from app.saranam.services.pps_suggestion import PPSSuggestionEngine
        result = PPSSuggestionEngine.suggest(visit_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/patients/<uuid:patient_id>/scores/<score_type>', methods=['GET'])
@jwt_required()
def get_patient_scores(patient_id, score_type):
    """Get time-series scores for trending (ESAS-R, PPS, or Vitals)."""
    try:
        result = AssessmentService.get_patient_scores(patient_id, score_type)
        # Vitals returns a dict with its own structure; ESAS/PPS return a list
        if isinstance(result, dict):
            return jsonify(result), 200
        return jsonify({'scores': result, 'total': len(result)}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/patients/<uuid:patient_id>/body-map/latest', methods=['GET'])
@jwt_required()
def latest_body_map(patient_id):
    """Return the most recent PRIOR visit's body map markers, for carry-forward.

    Mirrors the prescription carry-forward pattern: when a new visit's body
    map is still empty, the frontend calls this to pre-fill it from the last
    visit that actually has markers, instead of starting blank.

    Query param `exclude_visit` excludes the current visit so a freshly
    opened (still-empty) visit doesn't just find itself.

    Some visits may have body_map_annotations = [] (assessed, but no markers
    dropped) rather than null — those don't count as "has a map", so we scan
    back through several visits rather than stopping at the first non-null row.
    """
    try:
        from app.saranam.models.patient_visit import PatientVisit
        from app.saranam.models.doctor_assessment import DoctorAssessment

        exclude_visit = request.args.get('exclude_visit')

        q = (
            DoctorAssessment.query
            .join(PatientVisit, DoctorAssessment.visit_id == PatientVisit.id)
            .filter(PatientVisit.patient_id == patient_id)
            .filter(DoctorAssessment.body_map_annotations.isnot(None))
        )
        if exclude_visit:
            q = q.filter(DoctorAssessment.visit_id != exclude_visit)

        # Newest visit first by real-world visit_date; created_at breaks ties
        # for same-day visits (same precision issue as the full-history sort).
        q = q.order_by(PatientVisit.visit_date.desc(), DoctorAssessment.created_at.desc())

        for da in q.limit(20).all():
            markers = da.body_map_annotations
            if isinstance(markers, list) and len(markers) > 0:
                visit = PatientVisit.query.get(da.visit_id)
                return jsonify({
                    'markers': markers,
                    'source_visit_id': str(da.visit_id),
                    'source_visit_number': visit.visit_number if visit else None,
                    'source_visit_date': visit.visit_date.isoformat() if visit and visit.visit_date else None,
                }), 200

        return jsonify({
            'markers': None,
            'source_visit_id': None,
            'source_visit_number': None,
            'source_visit_date': None,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500