"""Patient-level AI summary routes.

GET    /saranam/patients/<id>/summary           — fetch saved snapshot
POST   /saranam/patients/<id>/summary/generate  — generate (no persist)
PUT    /saranam/patients/<id>/summary           — save clinician-edited snapshot

Snapshot model: one row per patient (UNIQUE on patient_id). Save = upsert.
"""
from datetime import datetime
from uuid import UUID

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.saranam import saranam_bp
from app.saranam.models.patient_ai_summary import PatientAiSummary
from app.extensions import db


@saranam_bp.route('/patients/<uuid:patient_id>/summary', methods=['GET'])
@jwt_required()
def get_patient_summary(patient_id):
    record = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
    if record is None:
        return jsonify(None), 200
    return jsonify(record.to_dict()), 200


@saranam_bp.route('/patients/<uuid:patient_id>/summary/generate', methods=['POST'])
@jwt_required()
def generate_patient_summary(patient_id):
    """Generate (no persist). Returns the merged body_locations draft alongside
    the summary text. Frontend persists via PUT.

    The merge respects `userEdited=true` rows in the existing snapshot:
    they are kept verbatim AND not removed even if the AI omits the slug.
    See body_locations.merge_ai_body_locations for the rules.
    """
    try:
        from app.ai.assessment_summary import summarize_patient, flatten_blocks
        from app.ai.body_locations import merge_ai_body_locations

        existing = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
        prev_locations = (existing.body_locations or []) if existing else []

        blocks, ai_locations_raw, model = summarize_patient(patient_id, prev_locations)
        merged, diff = merge_ai_body_locations(prev_locations, ai_locations_raw)

        return jsonify({
            'summary_blocks': blocks,
            'summary_text': flatten_blocks(blocks),  # back-compat fallback
            'body_locations': merged,
            'diff_stats': diff,
            'model': model,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI summary generation failed: {e}'}), 502


@saranam_bp.route('/patients/<uuid:patient_id>/summary', methods=['PUT'])
@jwt_required()
def save_patient_summary(patient_id):
    """Save patient summary. Accepts either:
      - new shape: {summary_blocks: {nursing, psychosocial, physiotherapy}, ...}
      - legacy:    {summary_text: "..."}

    summary_text is always persisted (flattened from blocks if blocks given)
    so legacy consumers keep working.
    """
    from app.ai.assessment_summary import flatten_blocks

    data = request.get_json() or {}
    blocks_in = data.get('summary_blocks')
    summary_text_in = (data.get('summary_text') or '').strip()

    if isinstance(blocks_in, dict) and any((blocks_in.get(k) or '').strip() for k in blocks_in):
        # Normalise: strip values, keep only known keys
        blocks = {
            k: (blocks_in.get(k) or '').strip()
            for k in ('nursing', 'psychosocial', 'physiotherapy')
        }
        summary_text = flatten_blocks(blocks) or summary_text_in
    else:
        blocks = None
        summary_text = summary_text_in

    if not summary_text and not blocks:
        return jsonify({'error': 'summary_blocks or summary_text is required'}), 400

    model_used = data.get('model') or data.get('model_used')

    # body_locations is optional. When the client omits it, leave the column
    # untouched (preserves existing AI highlights). When present, replace.
    body_locations_in = data.get('body_locations', None)

    user_id = UUID(get_jwt_identity())
    record = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
    if record is None:
        record = PatientAiSummary(
            patient_id=patient_id,
            summary_text=summary_text or '',
            summary_blocks=blocks,
            body_locations=body_locations_in if isinstance(body_locations_in, list) else [],
            model_used=model_used,
            generated_at=datetime.utcnow(),
            generated_by=user_id,
        )
        db.session.add(record)
    else:
        if summary_text:
            record.summary_text = summary_text
        if blocks is not None:
            record.summary_blocks = blocks
        if isinstance(body_locations_in, list):
            record.body_locations = body_locations_in
        if model_used:
            record.model_used = model_used
        record.generated_at = datetime.utcnow()
        record.generated_by = user_id
    db.session.commit()
    return jsonify(record.to_dict()), 200
