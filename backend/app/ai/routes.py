"""AI form builder API endpoints."""
from flask import Blueprint, request, jsonify
from app.auth.decorators import require_permission, get_current_user
from app.ai.services import AIFormService
from app.ai.models import AIFormSession
from app.extensions import db

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/ai-forms/generate', methods=['POST'])
@require_permission('create_form')
def generate_form():
    """
    Generate or refine form using AI.

    Request Body:
    {
      "llm_provider": "openai",  // "openai", "anthropic", "gemini"
      "llm_model": "gpt-4-turbo",  // optional, uses default if not specified
      "api_key": "sk-...",  // User's API key
      "mode": "healthcare",  // "general" or "healthcare"
      "user_message": "Create a sepsis screening form",
      "conversation_history": [],  // optional
      "current_schema": null  // optional, for refinement
    }

    Response:
    {
      "session_id": "uuid",
      "message": "AI explanation",
      "schema": {...},
      "suggestions": ["Add BMI", "Include allergies"],
      "tokens_used": 1523,
      "latency_ms": 2450
    }
    """
    data = request.json
    user = get_current_user()

    # Validate required fields
    if not data.get('llm_provider'):
        return jsonify({'error': 'llm_provider is required'}), 400
    if not data.get('api_key'):
        return jsonify({'error': 'api_key is required'}), 400
    if not data.get('user_message'):
        return jsonify({'error': 'user_message is required'}), 400

    result = AIFormService.generate_form(
        user_id=user.id,
        llm_provider=data['llm_provider'],
        llm_model=data.get('llm_model'),
        api_key=data['api_key'],
        mode=data.get('mode', 'general'),
        user_message=data['user_message'],
        conversation_history=data.get('conversation_history', []),
        current_schema=data.get('current_schema')
    )

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 200


@ai_bp.route('/ai-forms/refine', methods=['POST'])
@require_permission('create_form')
def refine_form():
    """
    Refine existing AI-generated form.

    Request Body:
    {
      "session_id": "uuid",
      "api_key": "sk-...",
      "user_message": "Make email field required"
    }

    Response: Same as /generate
    """
    data = request.json
    user = get_current_user()

    # Validate required fields
    if not data.get('session_id'):
        return jsonify({'error': 'session_id is required'}), 400
    if not data.get('api_key'):
        return jsonify({'error': 'api_key is required'}), 400
    if not data.get('user_message'):
        return jsonify({'error': 'user_message is required'}), 400

    # Get existing session
    session = AIFormSession.query.get(data['session_id'])
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if str(session.user_id) != str(user.id):
        return jsonify({'error': 'Unauthorized'}), 403

    # Reuse generate_form with session context
    result = AIFormService.generate_form(
        user_id=user.id,
        llm_provider=session.llm_provider,
        llm_model=session.llm_model,
        api_key=data['api_key'],
        mode=session.mode,
        user_message=data['user_message'],
        conversation_history=session.conversation_history,
        current_schema=session.current_schema
    )

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 200


@ai_bp.route('/ai-forms/finalize', methods=['POST'])
@require_permission('create_form')
def finalize_form():
    """
    Save AI-generated form to database.

    Request Body:
    {
      "session_id": "uuid",
      "form_name": "Sepsis Screening Form",  // optional, uses AI-generated name if not provided
      "form_description": "..."  // optional
    }

    Response:
    {
      "form_id": "uuid",
      "message": "Form created successfully"
    }
    """
    data = request.json
    user = get_current_user()

    if not data.get('session_id'):
        return jsonify({'error': 'session_id is required'}), 400

    # Verify session ownership
    session = AIFormSession.query.get(data['session_id'])
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if str(session.user_id) != str(user.id):
        return jsonify({'error': 'Unauthorized'}), 403

    result = AIFormService.finalize_form(
        session_id=data['session_id'],
        form_name=data.get('form_name'),
        form_description=data.get('form_description'),
        user_id=user.id
    )

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 201


@ai_bp.route('/ai-forms/sessions/<session_id>', methods=['GET'])
@require_permission('create_form')
def get_session(session_id):
    """
    Retrieve AI form session.

    Response:
    {
      "session": {
        "id": "uuid",
        "mode": "healthcare",
        "status": "active",
        "conversation_history": [...],
        "current_schema": {...},
        "created_at": "2026-02-27T...",
        "form_id": "uuid or null"
      }
    }
    """
    user = get_current_user()
    session = AIFormSession.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if str(session.user_id) != str(user.id):
        return jsonify({'error': 'Unauthorized'}), 403

    return jsonify({'session': session.to_dict()}), 200


@ai_bp.route('/ai-forms/sessions/<session_id>', methods=['DELETE'])
@require_permission('create_form')
def abandon_session(session_id):
    """
    Abandon AI form session.

    Response:
    {
      "message": "Session abandoned"
    }
    """
    user = get_current_user()
    session = AIFormSession.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if str(session.user_id) != str(user.id):
        return jsonify({'error': 'Unauthorized'}), 403

    session.status = 'abandoned'
    from app.extensions import db
    db.session.commit()

    return jsonify({'message': 'Session abandoned'}), 200


@ai_bp.route('/ai-forms/sessions', methods=['GET'])
@require_permission('create_form')
def list_sessions():
    """
    List user's AI form sessions.

    Query params:
    - status: filter by status (active, completed, abandoned)
    - limit: max number of results (default: 10)

    Response:
    {
      "sessions": [...]
    }
    """
    user = get_current_user()

    query = AIFormSession.query.filter_by(user_id=user.id)

    # Filter by status
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    # Limit results
    limit = int(request.args.get('limit', 10))
    sessions = query.order_by(AIFormSession.created_at.desc()).limit(limit).all()

    return jsonify({
        'sessions': [session.to_dict() for session in sessions]
    }), 200


@ai_bp.route('/ai-templates/generate', methods=['POST'])
@require_permission('create_form')
def generate_template():
    """Generate a form template using AI."""
    try:
        data = request.json
        user = get_current_user()

        # Required fields
        required_fields = ['llm_provider', 'api_key', 'user_message']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Use template-specific system prompt
        from app.ai.prompts import TEMPLATE_GENERATION_SYSTEM_PROMPT

        llm_provider = data['llm_provider']
        llm_model = data.get('llm_model')
        api_key = data['api_key']
        mode = data.get('mode', 'general')
        user_message = data['user_message']

        # Get LLM provider
        from app.ai.llm_providers import get_llm_provider
        llm = get_llm_provider(llm_provider, api_key, llm_model)

        # Build prompt
        messages = [{
            'role': 'system',
            'content': TEMPLATE_GENERATION_SYSTEM_PROMPT
        }, {
            'role': 'user',
            'content': user_message
        }]

        # Generate template
        response_text = llm.generate(messages, temperature=0.3, max_tokens=4000)

        # Extract metadata and schema
        import json
        import re

        # Try to extract JSON from response
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            response_json = json.loads(json_match.group(1))
        else:
            # Try direct JSON parse
            response_json = json.loads(response_text)

        # Validate structure
        if 'metadata' not in response_json or 'schema' not in response_json:
            return jsonify({'error': 'AI did not generate valid template structure'}), 400

        metadata = response_json['metadata']
        schema = response_json['schema']

        # Validate metadata fields
        required_metadata = ['name', 'description', 'category', 'use_cases', 'target_users']
        for field in required_metadata:
            if field not in metadata:
                return jsonify({'error': f'Missing metadata field: {field}'}), 400

        # Create session for tracking
        session = AIFormSession(
            user_id=user.id,
            llm_provider=llm_provider,
            llm_model=llm_model or 'default',
            mode='template',
            conversation_history=[
                {'role': 'user', 'content': user_message},
                {'role': 'assistant', 'content': response_text}
            ],
            current_schema=schema,
            status='active'
        )
        db.session.add(session)
        db.session.commit()

        return jsonify({
            'session_id': str(session.id),
            'metadata': metadata,
            'schema': schema,
            'message': f"Generated template: {metadata['name']}"
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/ai-templates/save', methods=['POST'])
@require_permission('create_form')
def save_template():
    """Save generated template to template library."""
    try:
        data = request.json
        user = get_current_user()

        # Required fields
        required_fields = ['session_id', 'name', 'category', 'description']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Get session
        session = AIFormSession.query.filter_by(
            id=data['session_id'],
            user_id=user.id
        ).first()

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if not session.current_schema:
            return jsonify({'error': 'No schema in session'}), 400

        # Create template using Form model with is_template=True
        from app.forms.models import Form

        # Build rich description with use cases and target users
        import json
        rich_description = {
            'description': data['description'],
            'use_cases': data.get('use_cases', []),
            'target_users': data.get('target_users', '')
        }

        template = Form(
            name=data['name'],
            description=data['description'],
            schema=session.current_schema['schema'],
            is_template=True,
            template_category=data['category'],
            template_description=json.dumps(rich_description),
            is_public=data.get('is_public', True),  # All users can create public templates
            created_by=user.id,
            is_active=True
        )

        db.session.add(template)

        # Mark session as completed
        session.status = 'completed'

        db.session.commit()

        return jsonify({
            'template_id': str(template.id),
            'message': f'Template "{template.name}" saved successfully'
        }), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
