"""Per-visit follow-up AI summary routes (2026-05-13 client meeting).

GET    /saranam/visits/<id>/follow-up-summary           — fetch saved row
POST   /saranam/visits/<id>/follow-up-summary/generate  — generate (no persist)
PUT    /saranam/visits/<id>/follow-up-summary           — save (upsert by visit_id)
GET    /saranam/patients/<id>/follow-up-summaries       — list for patient, DESC

The visit_id is the canonical key — one row per visit. Save = upsert. List
is what powers the "Past Records" section and "Latest Patient Health" card
on the patient Overview tab.
"""
from datetime import datetime
from uuid import UUID

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.saranam import saranam_bp
from app.saranam.models.visit_ai_summary import VisitAiSummary
from app.saranam.models.patient_visit import PatientVisit
from app.extensions import db


@saranam_bp.route('/visits/<uuid:visit_id>/follow-up-summary', methods=['GET'])
@jwt_required()
def get_followup_summary(visit_id):
    record = VisitAiSummary.query.filter_by(visit_id=visit_id).first()
    if record is None:
        return jsonify(None), 200
    return jsonify(record.to_dict()), 200


@saranam_bp.route('/visits/<uuid:visit_id>/follow-up-summary/generate',
                  methods=['POST'])
@jwt_required()
def generate_followup_summary(visit_id):
    """Generate a follow-up summary + body-map delta. Does NOT persist —
    the frontend reviews then PUTs to save.
    """
    try:
        from app.ai.assessment_summary import summarize_followup_visit
        from app.ai.body_locations import merge_ai_body_locations

        existing = VisitAiSummary.query.filter_by(visit_id=visit_id).first()
        prev_locations = (existing.body_locations or []) if existing else None

        text, ai_locations_raw, model = summarize_followup_visit(
            visit_id, previous_locations=prev_locations,
        )

        # When this visit doesn't yet have a saved row, the service falls back
        # to the most-recent prior visit's locations as the "starting state",
        # so we merge against the same prev list the AI saw.
        starting_state = prev_locations if prev_locations is not None else []
        merged, diff = merge_ai_body_locations(starting_state, ai_locations_raw)

        return jsonify({
            'summary': text,
            'body_locations': merged,
            'diff_stats': diff,
            'model': model,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI summary generation failed: {e}'}), 502


@saranam_bp.route('/visits/<uuid:visit_id>/follow-up-summary', methods=['PUT'])
@jwt_required()
def save_followup_summary(visit_id):
    visit = PatientVisit.query.get(visit_id)
    if visit is None:
        return jsonify({'error': 'Visit not found'}), 404

    data = request.get_json() or {}
    summary_text = (data.get('summary_text') or '').strip()
    if not summary_text:
        return jsonify({'error': 'summary_text is required'}), 400
    model_used = data.get('model') or data.get('model_used')
    body_locations_in = data.get('body_locations', None)

    user_id = UUID(get_jwt_identity())
    record = VisitAiSummary.query.filter_by(visit_id=visit_id).first()
    if record is None:
        record = VisitAiSummary(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            summary_text=summary_text,
            body_locations=body_locations_in if isinstance(body_locations_in, list) else [],
            model_used=model_used,
            generated_at=datetime.utcnow(),
            generated_by=user_id,
        )
        db.session.add(record)
    else:
        record.summary_text = summary_text
        if isinstance(body_locations_in, list):
            record.body_locations = body_locations_in
        if model_used:
            record.model_used = model_used
        record.generated_at = datetime.utcnow()
        record.generated_by = user_id
    db.session.commit()
    return jsonify(record.to_dict()), 200


@saranam_bp.route('/patients/<uuid:patient_id>/follow-up-summaries',
                  methods=['GET'])
@jwt_required()
def list_followup_summaries(patient_id):
    """All follow-up summaries for a patient, newest first.

    Powers the "Latest Patient Health" card (first row) and the
    "Past Records" section (full list, default collapsed) on the
    patient Overview tab.

    Each item is enriched with the parent visit's `visit_date`,
    `visit_number`, and `visit_type` so the UI can render the
    chronological log without extra round-trips.
    """
    rows = (
        db.session.query(VisitAiSummary, PatientVisit)
        .join(PatientVisit, PatientVisit.id == VisitAiSummary.visit_id)
        .filter(VisitAiSummary.patient_id == patient_id)
        .order_by(PatientVisit.visit_date.desc(),
                  VisitAiSummary.generated_at.desc())
        .all()
    )

    items = []
    for summary, visit in rows:
        d = summary.to_dict()
        d['visit_date'] = visit.visit_date.isoformat() if visit.visit_date else None
        d['visit_number'] = visit.visit_number
        d['visit_type'] = visit.visit_type
        items.append(d)

    return jsonify({'items': items, 'total': len(items)}), 200
