"""AI form generation services."""
from typing import Dict, List, Optional, Tuple
import json
import time
from datetime import datetime
from app.ai.llm_providers import get_llm_provider
from app.ai.prompts import (
    GENERAL_FORM_SYSTEM_PROMPT,
    HEALTHCARE_FORM_SYSTEM_PROMPT,
    REFINEMENT_PROMPT_PREFIX,
    RISK_RULE_GENERATION_PROMPT,
    CLINICAL_MAPPING_SUGGESTION_PROMPT
)
from app.ai.models import AIFormSession, AIGenerationLog
from app.forms.models import Form
from app.risk.models import FieldSection
from app.extensions import db


class AIFormService:
    """Core AI form generation service."""

    @staticmethod
    def generate_form(
        user_id: str,
        llm_provider: str,
        llm_model: str,
        api_key: str,
        mode: str,
        user_message: str,
        conversation_history: List[Dict] = None,
        current_schema: Dict = None
    ) -> Dict:
        """Generate or refine form using AI."""

        # 1. Validate and initialize LLM
        try:
            llm = get_llm_provider(llm_provider, api_key, llm_model)
        except Exception as e:
            return {'error': f'Failed to initialize LLM provider: {str(e)}'}, 400

        # Don't validate API key for now to save time/cost
        # In production, you may want to enable this
        # if not llm.validate_api_key():
        #     return {'error': 'Invalid API key'}, 400

        # 2. Create or retrieve session
        session = AIFormSession.query.filter_by(
            user_id=user_id,
            status='active'
        ).order_by(AIFormSession.created_at.desc()).first()

        if not session or session.llm_provider != llm_provider:
            session = AIFormSession(
                user_id=user_id,
                llm_provider=llm_provider,
                llm_model=llm_model,
                mode=mode,
                conversation_history=[],
                current_schema=current_schema,
                status='active'
            )
            db.session.add(session)
            db.session.flush()

        # 3. Build context-aware prompt
        system_prompt = (
            HEALTHCARE_FORM_SYSTEM_PROMPT if mode == 'healthcare'
            else GENERAL_FORM_SYSTEM_PROMPT
        )

        # Add field section context (if healthcare mode)
        if mode == 'healthcare':
            sections = FieldSection.query.filter_by(is_system=True).limit(10).all()
            if sections:
                section_context = "\n\nAVAILABLE FIELD SECTIONS (you can mention these):\n"
                for section in sections:
                    section_context += f"- {section.name} ({section.category}): {len(section.fields)} fields\n"
                system_prompt += section_context

        # Add refinement context if updating existing schema
        if current_schema or session.current_schema:
            schema_to_refine = current_schema or session.current_schema
            user_prompt = REFINEMENT_PROMPT_PREFIX.format(
                current_schema=json.dumps(schema_to_refine, indent=2),
                user_message=user_message
            )
        else:
            user_prompt = user_message

        # 4. Build message history
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history
        if conversation_history:
            messages.extend(conversation_history)

        # Add current user message
        messages.append({"role": "user", "content": user_prompt})

        # 5. Call LLM
        start_time = time.time()
        try:
            ai_response = llm.generate(messages, temperature=0.3, max_tokens=4000)
            latency_ms = int((time.time() - start_time) * 1000)
            tokens_used = llm.count_tokens(ai_response)

            # Log success
            log = AIGenerationLog(
                session_id=session.id,
                prompt_sent=user_prompt[:1000],  # Truncate to avoid DB bloat
                response_received=ai_response[:2000],  # Truncate
                tokens_used=tokens_used,
                latency_ms=latency_ms,
                success=True
            )
            db.session.add(log)

        except Exception as e:
            # Log failure
            log = AIGenerationLog(
                session_id=session.id,
                prompt_sent=user_prompt[:1000],
                response_received=None,
                success=False,
                error_message=str(e)
            )
            db.session.add(log)
            db.session.commit()
            return {'error': f'LLM generation failed: {str(e)}'}, 500

        # 6. Extract and validate schema from response
        schema = SchemaExtractor.extract_schema(ai_response)
        if not schema:
            return {'error': 'AI did not generate valid schema. Please try rephrasing your request.'}, 500

        # Validate against Form model
        is_valid, errors = SchemaValidator.validate_schema(schema)
        if not is_valid:
            return {'error': 'Generated schema is invalid', 'details': errors}, 500

        # 7. Update session
        session.current_schema = schema
        if not session.conversation_history:
            session.conversation_history = []
        session.conversation_history.append({"role": "user", "content": user_message})
        session.conversation_history.append({"role": "assistant", "content": ai_response})

        db.session.commit()

        # 8. Generate suggestions
        suggestions = SuggestionEngine.generate_suggestions(schema, mode)

        # 9. Extract explanation text (before ```json block)
        explanation = ai_response.split('```json')[0].strip() if '```json' in ai_response else ai_response[:500]

        return {
            'session_id': str(session.id),
            'message': explanation,
            'schema': schema,
            'suggestions': suggestions,
            'tokens_used': tokens_used,
            'latency_ms': latency_ms
        }

    @staticmethod
    def finalize_form(session_id: str, form_name: Optional[str] = None,
                     form_description: Optional[str] = None, user_id: str = None) -> Dict:
        """Save AI-generated form to database."""
        session = AIFormSession.query.get(session_id)
        if not session or not session.current_schema:
            return {'error': 'Session not found or no schema available'}, 404

        # Create Form
        form = Form(
            name=form_name or session.current_schema.get('name', 'AI Generated Form'),
            description=form_description or session.current_schema.get('description', ''),
            schema=session.current_schema.get('schema'),
            created_by=user_id,
            is_active=True,
            version=1
        )

        # Validate schema before saving
        is_valid, error_msg = form.validate_schema()
        if not is_valid:
            return {'error': f'Invalid form schema: {error_msg}'}, 400

        db.session.add(form)
        db.session.flush()

        # Update session
        session.form_id = form.id
        session.status = 'completed'
        session.completed_at = datetime.utcnow()

        db.session.commit()

        return {
            'form_id': str(form.id),
            'message': 'Form created successfully'
        }


class SchemaExtractor:
    """Extract JSON schema from AI response."""

    @staticmethod
    def extract_schema(ai_response: str) -> Optional[Dict]:
        """Extract JSON from markdown code blocks or raw JSON."""
        # Try to find ```json block
        if '```json' in ai_response:
            start = ai_response.find('```json') + 7
            end = ai_response.find('```', start)
            json_str = ai_response[start:end].strip()
        elif '```' in ai_response:
            start = ai_response.find('```') + 3
            end = ai_response.find('```', start)
            json_str = ai_response[start:end].strip()
        else:
            # Try to find JSON object in response
            start = ai_response.find('{')
            end = ai_response.rfind('}') + 1
            if start >= 0 and end > start:
                json_str = ai_response[start:end].strip()
            else:
                return None

        try:
            schema = json.loads(json_str)
            return schema
        except json.JSONDecodeError:
            return None


class SchemaValidator:
    """Validate generated schema against Form model."""

    @staticmethod
    def validate_schema(schema: Dict) -> Tuple[bool, List[str]]:
        """Validate form schema structure."""
        errors = []

        # Check top-level structure
        if 'name' not in schema:
            errors.append("Missing 'name' field")

        if 'schema' not in schema:
            errors.append("Missing 'schema' field")
            return False, errors

        form_schema = schema['schema']

        # Check pages or fields
        has_pages = 'pages' in form_schema
        has_fields = 'fields' in form_schema

        if not has_pages and not has_fields:
            errors.append("Schema must have 'pages' or 'fields'")
            return False, errors

        if has_pages and has_fields:
            errors.append("Schema cannot have both 'pages' and 'fields' at root level")
            return False, errors

        # Collect all fields
        all_fields = []
        if has_pages:
            if not isinstance(form_schema['pages'], list):
                errors.append("'pages' must be an array")
                return False, errors
            for page in form_schema['pages']:
                if 'id' not in page:
                    errors.append(f"Page missing 'id'")
                if 'fields' in page and isinstance(page['fields'], list):
                    all_fields.extend(page['fields'])
        else:
            if not isinstance(form_schema['fields'], list):
                errors.append("'fields' must be an array")
                return False, errors
            all_fields = form_schema['fields']

        # Validate each field
        field_ids = set()
        valid_types = [
            'text', 'number', 'numeric', 'date', 'time', 'email', 'phone', 'url',
            'textarea', 'select', 'radio', 'checkbox', 'file', 'linearScale',
            'painScale', 'severityRating', 'symptomChecklist', 'functionalStatus',
            'riskScoreDisplay', 'geoLocation', 'section'
        ]

        for field in all_fields:
            if 'id' not in field:
                errors.append(f"Field missing 'id'")
                continue
            elif field['id'] in field_ids:
                errors.append(f"Duplicate field ID: {field['id']}")
            else:
                field_ids.add(field['id'])

            if 'type' not in field:
                errors.append(f"Field {field.get('id', '?')} missing 'type'")
            elif field['type'] not in valid_types:
                errors.append(f"Invalid field type: {field['type']}")

            if 'label' not in field:
                errors.append(f"Field {field.get('id', '?')} missing 'label'")

            # Validate select/radio have options
            if field.get('type') in ['select', 'radio']:
                if 'options' not in field or not isinstance(field.get('options'), list):
                    errors.append(f"Field {field.get('id')} of type {field.get('type')} must have 'options' array")

        return len(errors) == 0, errors


class SuggestionEngine:
    """Generate next-step suggestions."""

    @staticmethod
    def generate_suggestions(schema: Dict, mode: str) -> List[str]:
        """Generate contextual suggestions."""
        suggestions = []

        # Extract all fields and pages
        all_fields = []
        form_schema = schema.get('schema', {})
        pages = form_schema.get('pages', [])

        if pages:
            for page in pages:
                all_fields.extend(page.get('fields', []))
        else:
            all_fields = form_schema.get('fields', [])

        field_types = [f.get('type') for f in all_fields]
        field_labels = [f.get('label', '').lower() for f in all_fields]
        field_ids = [f.get('id', '') for f in all_fields]

        if mode == 'healthcare':
            # Check for vital signs with specific suggestions
            vital_checks = {
                'blood pressure': 'Add blood pressure fields (systolic/diastolic) with LOINC codes',
                'heart rate': 'Add heart rate field (LOINC: 8867-4)',
                'temperature': 'Add temperature field (LOINC: 8310-5)',
                'respiratory': 'Add respiratory rate field (LOINC: 9279-1)',
                'spo2': 'Add SpO2 oxygen saturation field (LOINC: 2708-6)',
                'weight': 'Add weight field for BMI calculation (LOINC: 29463-7)',
                'height': 'Add height field for BMI calculation (LOINC: 8302-2)'
            }

            for vital, suggestion in vital_checks.items():
                if not any(vital in label for label in field_labels):
                    suggestions.append(f"💡 {suggestion}")
                    if len(suggestions) >= 2:
                        break

            # Check for risk scoring
            has_risk_display = 'riskScoreDisplay' in field_types
            if not has_risk_display and len(all_fields) > 5:
                suggestions.append("⚠️ Add risk score display field with qSOFA or NEWS2 criteria")

            # Check for clinical mapping on numeric fields
            numeric_fields_without_mapping = [
                f for f in all_fields
                if f.get('type') in ['number', 'numeric']
                and 'clinicalMapping' not in f
                and f.get('id') not in ['age', 'phone']  # Skip non-clinical numerics
            ]
            if numeric_fields_without_mapping:
                field_name = numeric_fields_without_mapping[0].get('label', 'vital sign')
                suggestions.append(f"🏥 Add LOINC code to '{field_name}' field")

            # Check for ABHA ID
            has_abha = any('abha' in label or 'patient id' in label for label in field_labels)
            if not has_abha:
                suggestions.append("🆔 Add ABHA ID field for ABDM compliance")

            # Check for emergency contact
            has_emergency = any('emergency' in label or 'contact' in label for label in field_labels)
            if not has_emergency and len(all_fields) >= 3:
                suggestions.append("📞 Add emergency contact information field")

            # Check for medical history
            has_history = any('history' in label or 'medical condition' in label for label in field_labels)
            if not has_history and len(all_fields) >= 5:
                suggestions.append("📋 Add medical history section (allergies, medications, conditions)")

            # Check for consent
            has_consent = any('consent' in label for label in field_labels)
            if not has_consent and len(all_fields) >= 8:
                suggestions.append("✅ Add patient consent checkbox for data sharing")

        else:  # General mode
            # Check for contact information
            has_email = any('email' in label for label in field_labels)
            has_phone = any('phone' in label for label in field_labels)

            if not has_email:
                suggestions.append("📧 Add email field for contact")
            if not has_phone:
                suggestions.append("📱 Add phone number field")

            # Check for required fields
            required_fields = [f for f in all_fields if f.get('required')]
            if len(required_fields) == 0 and len(all_fields) > 0:
                suggestions.append("⚠️ Make important fields required")

            # Check for validation
            fields_with_validation = [f for f in all_fields if 'validation' in f]
            if len(fields_with_validation) < len(all_fields) // 2 and len(all_fields) >= 3:
                suggestions.append("✓ Add validation rules to ensure data quality")

        # General organizational suggestions
        if len(all_fields) > 15 and not pages:
            suggestions.append("📄 Split into multiple pages for better user experience")

        if pages and len(pages) == 1 and len(all_fields) > 10:
            suggestions.append("📑 Add more pages to organize related fields")

        if len(all_fields) < 3:
            suggestions.append("➕ Add more fields to make the form more comprehensive")

        # Check for sections
        has_sections = 'section' in field_types
        if len(all_fields) > 8 and not has_sections and not pages:
            suggestions.append("📂 Add section headers to organize fields into groups")

        return suggestions[:6]  # Limit to 6 suggestions
