"""Risk assessment API routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID
from app.risk.services import RiskAssessmentService, RiskRuleService, RiskLevelService
from app.risk.models import FieldRiskRule, FormRiskLevel, FieldSection
from app.extensions import db
from app.auth.decorators import get_current_user

bp = Blueprint('risk', __name__, url_prefix='/api')


# Risk Rules Endpoints

@bp.route('/forms/<form_id>/risk-rules', methods=['GET'])
@jwt_required()
def get_form_risk_rules(form_id):
    """Get all risk rules for a form."""
    try:
        rules = RiskRuleService.get_form_risk_rules(UUID(form_id))
        return jsonify({
            'success': True,
            'risk_rules': [rule.to_dict() for rule in rules]
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/forms/<form_id>/risk-rules', methods=['POST'])
@jwt_required()
def create_risk_rule(form_id):
    """Create a new risk rule for a form field."""
    try:
        data = request.get_json()

        if not data.get('field_id'):
            return jsonify({'success': False, 'error': 'field_id is required'}), 400
        if not data.get('rule_type'):
            return jsonify({'success': False, 'error': 'rule_type is required'}), 400
        if not data.get('condition'):
            return jsonify({'success': False, 'error': 'condition is required'}), 400

        rule = RiskRuleService.create_risk_rule(
            form_id=UUID(form_id),
            field_id=data['field_id'],
            rule_type=data['rule_type'],
            condition=data['condition'],
            created_by=get_jwt_identity()
        )

        return jsonify({
            'success': True,
            'risk_rule': rule.to_dict()
        }), 201

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/forms/<form_id>/risk-rules/<rule_id>', methods=['PUT'])
@jwt_required()
def update_risk_rule(form_id, rule_id):
    """Update a risk rule."""
    try:
        data = request.get_json()

        if not data.get('condition'):
            return jsonify({'success': False, 'error': 'condition is required'}), 400

        rule = RiskRuleService.update_risk_rule(
            rule_id=UUID(rule_id),
            condition=data['condition']
        )

        return jsonify({
            'success': True,
            'risk_rule': rule.to_dict()
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/forms/<form_id>/risk-rules/<rule_id>', methods=['DELETE'])
@jwt_required()
def delete_risk_rule(form_id, rule_id):
    """Delete a risk rule."""
    try:
        RiskRuleService.delete_risk_rule(UUID(rule_id))

        return jsonify({
            'success': True,
            'message': 'Risk rule deleted successfully'
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# Risk Levels Endpoints

@bp.route('/forms/<form_id>/risk-levels', methods=['GET'])
@jwt_required()
def get_risk_levels(form_id):
    """Get risk levels for a form."""
    try:
        levels = RiskLevelService.get_risk_levels(UUID(form_id))
        return jsonify({
            'success': True,
            'risk_levels': [level.to_dict() for level in levels]
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/forms/<form_id>/risk-levels', methods=['POST'])
@jwt_required()
def set_risk_levels(form_id):
    """Set risk levels for a form (replaces existing)."""
    try:
        data = request.get_json()

        if not data.get('levels'):
            return jsonify({'success': False, 'error': 'levels array is required'}), 400

        levels = RiskLevelService.set_risk_levels(
            form_id=UUID(form_id),
            levels=data['levels'],
            created_by=get_jwt_identity()
        )

        return jsonify({
            'success': True,
            'risk_levels': [level.to_dict() for level in levels]
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# Risk Score Calculation Endpoints

@bp.route('/submissions/<submission_id>/calculate-risk', methods=['POST'])
@jwt_required()
def calculate_risk(submission_id):
    """Calculate risk score for a submission."""
    try:
        result = RiskAssessmentService.calculate_and_save(UUID(submission_id))

        return jsonify({
            'success': True,
            'risk_score': result
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/submissions/<submission_id>/risk-score', methods=['GET'])
@jwt_required()
def get_risk_score(submission_id):
    """Get cached risk score for a submission."""
    try:
        risk_score = RiskAssessmentService.get_risk_score(UUID(submission_id))

        if not risk_score:
            return jsonify({
                'success': False,
                'error': 'Risk score not found'
            }), 404

        return jsonify({
            'success': True,
            'risk_score': risk_score.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/forms/<form_id>/recalculate-risk', methods=['POST'])
@jwt_required()
def recalculate_form_risk(form_id):
    """Recalculate risk scores for all submissions of a form."""
    try:
        result = RiskAssessmentService.recalculate_all_for_form(UUID(form_id))

        return jsonify({
            'success': True,
            'result': result
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/forms/<form_id>/high-risk-submissions', methods=['GET'])
@jwt_required()
def get_high_risk_submissions(form_id):
    """Get high-risk submissions for a form."""
    try:
        risk_level = request.args.get('risk_level', 'High')
        submissions = RiskAssessmentService.get_high_risk_submissions(
            form_id=UUID(form_id),
            risk_level=risk_level
        )

        return jsonify({
            'success': True,
            'submissions': submissions
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/forms/<form_id>/risk-distribution', methods=['GET'])
@jwt_required()
def get_risk_distribution(form_id):
    """Get distribution of risk levels for a form."""
    try:
        distribution = RiskAssessmentService.get_risk_distribution(UUID(form_id))

        return jsonify({
            'success': True,
            'distribution': distribution
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# Field Sections Endpoints

@bp.route('/field-sections', methods=['GET'])
@jwt_required()
def get_field_sections():
    """Get all field sections, optionally filtered by category."""
    try:
        category = request.args.get('category')

        query = FieldSection.query

        if category:
            query = query.filter_by(category=category)

        sections = query.all()

        return jsonify({
            'success': True,
            'sections': [section.to_dict() for section in sections]
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/field-sections', methods=['POST'])
@jwt_required()
def create_field_section():
    """Create a new field section."""
    try:
        data = request.get_json()

        if not data.get('name'):
            return jsonify({'success': False, 'error': 'name is required'}), 400
        if not data.get('fields'):
            return jsonify({'success': False, 'error': 'fields array is required'}), 400

        section = FieldSection(
            name=data['name'],
            description=data.get('description'),
            category=data.get('category'),
            fields=data['fields'],
            is_system=data.get('is_system', False),
            created_by=get_jwt_identity()
        )

        # Validate fields structure
        is_valid, message = section.validate_fields()
        if not is_valid:
            return jsonify({'success': False, 'error': message}), 400

        db.session.add(section)
        db.session.commit()

        return jsonify({
            'success': True,
            'section': section.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/field-sections/<section_id>', methods=['GET'])
@jwt_required()
def get_field_section(section_id):
    """Get a specific field section."""
    try:
        section = FieldSection.query.get(UUID(section_id))

        if not section:
            return jsonify({
                'success': False,
                'error': 'Field section not found'
            }), 404

        return jsonify({
            'success': True,
            'section': section.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/field-sections/<section_id>', methods=['PUT'])
@jwt_required()
def update_field_section(section_id):
    """Update a field section."""
    try:
        section = FieldSection.query.get(UUID(section_id))

        if not section:
            return jsonify({
                'success': False,
                'error': 'Field section not found'
            }), 404

        # Prevent updating system sections
        if section.is_system and str(section.created_by) != str(get_jwt_identity()):
            return jsonify({
                'success': False,
                'error': 'Cannot update system field section'
            }), 403

        data = request.get_json()

        if 'name' in data:
            section.name = data['name']
        if 'description' in data:
            section.description = data['description']
        if 'category' in data:
            section.category = data['category']
        if 'fields' in data:
            section.fields = data['fields']

            # Validate new fields
            is_valid, message = section.validate_fields()
            if not is_valid:
                return jsonify({'success': False, 'error': message}), 400

        db.session.commit()

        return jsonify({
            'success': True,
            'section': section.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/field-sections/<section_id>', methods=['DELETE'])
@jwt_required()
def delete_field_section(section_id):
    """Delete a field section."""
    try:
        section = FieldSection.query.get(UUID(section_id))

        if not section:
            return jsonify({
                'success': False,
                'error': 'Field section not found'
            }), 404

        # Prevent deleting system sections
        if section.is_system:
            return jsonify({
                'success': False,
                'error': 'Cannot delete system field section'
            }), 403

        db.session.delete(section)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Field section deleted successfully'
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
