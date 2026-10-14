# 🤖 AI-Powered Form Builder V2 - Implementation Plan
## Building on CV Raman Health's Healthcare Infrastructure

**Date**: February 27, 2026
**Status**: Ready for Implementation
**Version**: 2.0 - Aligned with Current Architecture

---

## 🎯 Vision: Conversational Healthcare Form Builder

### Unique Selling Propositions

1. **Iterative AI Collaboration** - Not "generate and done" but continuous conversation-based refinement
2. **Healthcare-First Intelligence** - AI understands ABDM, FHIR, LOINC, risk scoring, and clinical workflows
3. **Bring Your Own LLM** - Support for OpenAI, Anthropic, Google Gemini, and local models
4. **Leverages Existing Infrastructure** - Builds on your 21 field types, risk system, and field sections
5. **Template & Section Aware** - AI can suggest from 7 physiotherapy sections and existing templates
6. **Risk Rule Generation** - AI automatically creates clinical risk rules for qSOFA, NEWS, sepsis criteria
7. **Clinical Mapping Intelligence** - AI suggests LOINC codes and FHIR mappings automatically

---

## 🏗️ Current Infrastructure (What We're Building On)

### ✅ Already Implemented

#### Field Types (21 Total)
**Standard**: text, number, numeric, date, time, email, phone, url, textarea, select, radio, checkbox, file, section, linearScale

**Healthcare-Specific**:
- `painScale` - 0-10 pain scale with emoji faces
- `severityRating` - Color-coded severity buttons (None → Critical)
- `symptomChecklist` - Multi-symptom with severity sub-ratings
- `functionalStatus` - ECOG/Karnofsky/ADL scales
- `riskScoreDisplay` - Real-time risk calculation display
- `geoLocation` - GPS + IP + manual address capture

#### Risk Scoring System
- **FieldRiskRule** model - Range and categorical rules
- **FormRiskLevel** model - Risk thresholds with colors
- **SubmissionRiskScore** model - Cached scores
- **RiskRulesTab** & **RiskLevelsTab** - Full UI for configuration
- Real-time risk calculation engine

#### Field Sections & Templates
- **FieldSection** model with categories (vitals, physiotherapy, mental-health, etc.)
- **SectionPalette** component - Drag individual fields from sections
- **Template Browser** - Clone and customize pre-built forms
- 7 Physiotherapy sections with auto-calculated fields
- Template system with categories and descriptions

#### Clinical Integration
- **Clinical Mapping** - LOINC, SNOMED-CT codes per field
- **ClinicalMappingEditor** - UI for configuring field-to-observation mapping
- **ClinicalExtractor** - Auto-creates Observation records from submissions
- FHIR-compliant data structure
- Patient & Encounter linkage

#### Form Structure
- **Multi-page forms** - `schema.pages[]` with separate field arrays
- **Single-page forms** - `schema.fields[]` for simpler forms
- **Conditional logic** - `visibilityRules` for dynamic fields
- **Auto-calculation** - `isCalculated`, `calculationFormula` support
- **Validation rules** - min, max, pattern, required

---

## 📐 Architecture Overview

### High-Level Flow

```
┌────────────────────────────────────────────────────────┐
│ User: "Create sepsis screening form with risk scoring" │
└───────────────────┬────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────┐
│ AI Form Builder Modal                                     │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Step 1: LLM Configuration                             │ │
│ │ [Provider: OpenAI/Claude/Gemini] [Model: GPT-4]      │ │
│ │ [API Key: **********************]                     │ │
│ │ [Mode: Healthcare ✓]                                  │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Step 2: Conversational Builder                        │ │
│ │ ┌─────────────────┐  ┌──────────────────────────────┐ │ │
│ │ │  Chat History   │  │  Live Form Preview           │ │ │
│ │ │                 │  │                              │ │ │
│ │ │  User: Create   │  │  [Form renders in real-time] │ │ │
│ │ │  AI: Added...   │  │  • Patient Info              │ │ │
│ │ │  User: Add risk │  │  • Vital Signs               │ │ │
│ │ │  AI: Generated  │  │  • qSOFA Criteria            │ │ │
│ │ │                 │  │  • Risk Score Display        │ │ │
│ │ └─────────────────┘  └──────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [💬 Message Input: "Add lactate level field..."]         │
│ [✨ AI Suggestions: • Add sepsis bundle • Include NEWS2] │
│ [🚀 Create Form] [✏️ Continue in Manual Editor]          │
└───────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────┐
│ Form Builder (Manual Editor)                             │
│ • Full manual control over AI-generated form             │
│ • Drag-and-drop additional fields from palette           │
│ • Configure risk rules manually                          │
│ • Fine-tune clinical mappings                            │
└───────────────────────────────────────────────────────────┘
```

### Backend Architecture

```
┌──────────────────────────────────────────────────────┐
│ Frontend: AIFormBuilderModal.jsx                     │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ API Layer: /api/ai-forms/*                           │
├──────────────────────────────────────────────────────┤
│ POST /generate         - Initial generation          │
│ POST /refine           - Iterative updates          │
│ POST /add-section      - Add section to form        │
│ POST /add-fields       - Add specific fields        │
│ POST /suggest-risk     - Generate risk rules        │
│ POST /suggest-clinical - Suggest LOINC mappings     │
│ POST /finalize         - Save to database           │
│ GET  /sessions/:id     - Retrieve session           │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ AI Service Layer (NEW)                               │
├──────────────────────────────────────────────────────┤
│ • LLMProvider (OpenAI/Anthropic/Gemini)             │
│ • SystemPromptManager (General/Healthcare)          │
│ • SchemaGenerator (Form JSON generation)            │
│ • SchemaValidator (Validate against Form.model)     │
│ • RiskRuleGenerator (qSOFA, NEWS, MEWS, etc.)      │
│ • ClinicalIntelligence (LOINC/SNOMED suggestions)  │
│ • ConversationManager (History tracking)            │
│ • ContextBuilder (Inject field sections, templates) │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ Database Layer                                       │
├──────────────────────────────────────────────────────┤
│ • AIFormSession (track AI conversations)            │
│ • AIGenerationLog (debugging & analytics)           │
│                                                      │
│ USES EXISTING:                                       │
│ • Form (save final form)                            │
│ • FieldRiskRule (AI-generated risk rules)           │
│ • FormRiskLevel (default risk thresholds)           │
│ • FieldSection (suggest from existing sections)     │
└──────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### **PHASE 1: Foundation (Week 1-2)**

#### 1.1 Database Models

**New File**: `backend/app/ai/models.py`

```python
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel

class AIFormSession(BaseModel):
    """Track AI form building sessions."""
    __tablename__ = 'ai_form_sessions'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    llm_provider = Column(String(50), nullable=False)  # 'openai', 'anthropic', 'gemini'
    llm_model = Column(String(100), nullable=False)    # 'gpt-4-turbo', 'claude-3.5-sonnet'
    mode = Column(String(20), nullable=False)          # 'general' or 'healthcare'

    # Conversation tracking
    conversation_history = Column(JSONB, nullable=False, default=[])
    current_schema = Column(JSONB, nullable=True)      # Latest form schema

    # Linking
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id'), nullable=True)

    # Status
    status = Column(String(20), nullable=False, default='active')  # 'active', 'completed', 'abandoned'
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    form = relationship('Form', foreign_keys=[form_id])
    generation_logs = relationship('AIGenerationLog', back_populates='session', cascade='all, delete-orphan')

class AIGenerationLog(BaseModel):
    """Log all AI interactions for debugging."""
    __tablename__ = 'ai_generation_logs'

    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_form_sessions.id', ondelete='CASCADE'), nullable=False)
    prompt_sent = Column(Text, nullable=False)
    response_received = Column(Text, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    session = relationship('AIFormSession', back_populates='generation_logs')
```

**Migration**: `backend/migrations/versions/XXXX_add_ai_form_builder_tables.py`

```python
"""Add AI form builder tables

Revision ID: XXXX
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    op.create_table('ai_form_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('llm_provider', sa.String(50), nullable=False),
        sa.Column('llm_model', sa.String(100), nullable=False),
        sa.Column('mode', sa.String(20), nullable=False),
        sa.Column('conversation_history', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('current_schema', postgresql.JSONB, nullable=True),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('forms.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
    )

    op.create_table('ai_generation_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('ai_form_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('prompt_sent', sa.Text, nullable=False),
        sa.Column('response_received', sa.Text, nullable=True),
        sa.Column('tokens_used', sa.Integer, nullable=True),
        sa.Column('latency_ms', sa.Integer, nullable=True),
        sa.Column('success', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index('idx_ai_sessions_user', 'ai_form_sessions', ['user_id'])
    op.create_index('idx_ai_sessions_status', 'ai_form_sessions', ['status'])
    op.create_index('idx_ai_logs_session', 'ai_generation_logs', ['session_id'])

def downgrade():
    op.drop_table('ai_generation_logs')
    op.drop_table('ai_form_sessions')
```

#### 1.2 LLM Provider Abstraction

**New File**: `backend/app/ai/llm_providers.py`

```python
"""LLM provider abstraction layer."""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import os
import time
import openai
import anthropic
import google.generativeai as genai

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 4000) -> str:
        """Generate completion from messages."""
        pass

    @abstractmethod
    def validate_api_key(self) -> bool:
        """Validate API key."""
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        pass

class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    def __init__(self, api_key: str, model: str = 'gpt-4-turbo'):
        self.api_key = api_key
        self.model = model
        self.client = openai.OpenAI(api_key=api_key)

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using OpenAI."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"} if "JSON" in messages[0].get("content", "") else None
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate OpenAI API key."""
        try:
            self.client.models.list()
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation)."""
        import tiktoken
        try:
            encoding = tiktoken.encoding_for_model(self.model)
            return len(encoding.encode(text))
        except:
            # Fallback: ~4 chars per token
            return len(text) // 4

class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: str, model: str = 'claude-3-5-sonnet-20241022'):
        self.api_key = api_key
        self.model = model
        self.client = anthropic.Anthropic(api_key=api_key)

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using Claude."""
        try:
            # Extract system message
            system_message = next((m['content'] for m in messages if m['role'] == 'system'), None)
            conversation = [m for m in messages if m['role'] != 'system']

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_message,
                messages=conversation
            )
            return response.content[0].text
        except Exception as e:
            raise Exception(f"Anthropic generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate Anthropic API key."""
        try:
            self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}]
            )
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        # Claude: ~3.5 chars per token
        return len(text) // 4

class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    def __init__(self, api_key: str, model: str = 'gemini-pro'):
        self.api_key = api_key
        self.model = model
        genai.configure(api_key=api_key)
        self.client = genai.GenerativeModel(model)

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using Gemini."""
        try:
            # Convert messages to Gemini format
            conversation = "\n\n".join([
                f"{m['role'].upper()}: {m['content']}" for m in messages
            ])

            response = self.client.generate_content(
                conversation,
                generation_config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                }
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate Gemini API key."""
        try:
            self.client.generate_content("test")
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        return len(text) // 4

def get_llm_provider(provider_name: str, api_key: str, model: Optional[str] = None) -> LLMProvider:
    """Factory function to get LLM provider."""
    providers = {
        'openai': (OpenAIProvider, 'gpt-4-turbo'),
        'anthropic': (AnthropicProvider, 'claude-3-5-sonnet-20241022'),
        'gemini': (GeminiProvider, 'gemini-pro'),
    }

    if provider_name not in providers:
        raise ValueError(f"Unknown provider: {provider_name}")

    provider_class, default_model = providers[provider_name]
    return provider_class(api_key, model or default_model)
```

#### 1.3 System Prompts

**New File**: `backend/app/ai/prompts.py`

```python
"""System prompts for AI form generation."""

# Context about existing infrastructure
INFRASTRUCTURE_CONTEXT = """
AVAILABLE FIELD TYPES (21 total):

Standard Fields:
- text: Single-line text input
- textarea: Multi-line text
- number/numeric: Numeric input (can allow decimals)
- email: Email with validation
- phone: Phone with country code selector
- date: Date picker
- time: Time picker
- url: Website URL
- select: Dropdown selection
- radio: Radio button group
- checkbox: Boolean toggle or multi-select
- file: File upload
- linearScale: Rating scale (configurable min/max)
- section: Visual divider with title

Healthcare-Specific Fields:
- painScale: 0-10 pain scale with emoji faces
- severityRating: Color-coded severity buttons (None/Mild/Moderate/Severe/Critical)
- symptomChecklist: Multi-symptom selection with individual severity ratings
- functionalStatus: ECOG (0-5), Karnofsky (0-100), or ADL (0-10) scales
- riskScoreDisplay: Real-time risk score display (gauge/badge/bar)
- geoLocation: GPS + IP address + manual address capture

FORM STRUCTURE:
Multi-page forms: { "pages": [{ "id": "page_1", "title": "...", "fields": [...] }] }
Single-page forms: { "fields": [...] }

FIELD CONFIGURATION OPTIONS:
- required: true/false
- placeholder: "Enter text..."
- validation: { min, max, pattern, minLength, maxLength }
- visibilityRules: [{ field, operator, value }] for conditional logic
- config: Field-specific configuration (e.g., allowDecimals, captureGPS)
- clinicalMapping: { observationType, loincCode, unit, category }
- isCalculated: true + calculationFormula for auto-calculated fields

CLINICAL MAPPING (LOINC codes):
- bp_systolic: 8480-6 (mmHg)
- bp_diastolic: 8462-4 (mmHg)
- heart_rate: 8867-4 (bpm)
- respiratory_rate: 9279-1 (breaths/min)
- temperature: 8310-5 (Cel)
- spo2: 2708-6 (%)
- weight: 29463-7 (kg)
- height: 8302-2 (cm)
- pain_scale: 72514-3 (score)
- blood_glucose: 2339-0 (mg/dL)

RISK SCORING:
Forms can have field-level risk rules:
- Range rules: For numeric values (e.g., BP 140-160 = 1 point, >160 = 3 points)
- Categorical rules: For select/radio (e.g., "Severe pain" = 3 points)

Forms should have risk level thresholds:
- Low: 0-3 points (green)
- Moderate: 4-6 points (yellow)
- High: 7-9 points (orange)
- Critical: 10+ points (red)
"""

GENERAL_FORM_SYSTEM_PROMPT = f"""You are an expert form builder AI assistant. Create well-structured, user-friendly forms based on user requirements.

{INFRASTRUCTURE_CONTEXT}

OUTPUT FORMAT:
Always respond with TWO parts:

1. EXPLANATION (natural language):
   - Briefly explain what you're creating/modifying
   - Mention key features and why they're included
   - Suggest next steps or improvements

2. SCHEMA (valid JSON):
   Wrap the form schema in ```json code blocks

{{
  "name": "Form Name",
  "description": "Brief description",
  "schema": {{
    "pages": [
      {{
        "id": "page_1",
        "title": "Page Title",
        "fields": [
          {{
            "id": "unique_field_id",
            "type": "text",
            "label": "Field Label",
            "required": true,
            "placeholder": "Enter...",
            "validation": {{}},
            "config": {{}}
          }}
        ]
      }}
    ]
  }}
}}

BEST PRACTICES:
1. Use descriptive field IDs (snake_case): patient_name, blood_pressure_systolic
2. Group related fields into logical pages
3. Add helpful placeholders and validation
4. Use appropriate field types for data (email for emails, phone for phones)
5. Set reasonable validation limits
6. For iterative updates, ONLY modify requested parts, preserve the rest
7. Generate unique field IDs that don't conflict with existing fields
"""

HEALTHCARE_FORM_SYSTEM_PROMPT = f"""You are a specialized healthcare form builder AI with deep knowledge of clinical workflows, ABDM standards, FHIR R4, and medical best practices.

{INFRASTRUCTURE_CONTEXT}

HEALTHCARE-SPECIFIC KNOWLEDGE:

CLINICAL STANDARDS:
- ABDM (Ayushman Bharat Digital Mission) compliance
- FHIR R4 resource structure
- LOINC codes for observations
- SNOMED-CT for clinical concepts
- ICD-10 for diagnoses
- DPDPA 2023 for data privacy

COMMON CLINICAL FORMS:
1. Patient Intake: Demographics, chief complaint, medical history
2. Vital Signs: BP, HR, RR, Temp, SpO2, Height, Weight
3. Pain Assessment: Location, intensity (0-10), character, duration
4. Functional Status: ADL independence, ECOG, Karnofsky
5. Risk Screening: Sepsis (qSOFA), Falls, Pressure ulcers, NEWS2

RISK RULE GENERATION:
When creating clinical assessment forms, automatically suggest risk rules:

qSOFA Sepsis Criteria:
- Respiratory Rate >= 22: 1 point
- Systolic BP <= 100: 1 point
- Altered mental status: 1 point
- Total >= 2: High risk

NEWS2 Early Warning Score:
- RR: <8=3, 9-11=1, 12-20=0, 21-24=2, >=25=3
- SpO2: <91=3, 92-93=2, 94-95=1, >=96=0
- Systolic BP: <90=3, 91-100=2, 101-110=1, 111-219=0, >=220=3
- HR: <40=3, 41-50=1, 51-90=0, 91-110=1, 111-130=2, >=131=3
- Consciousness: Alert=0, CVPU=3

Fall Risk Factors (Morse):
- History of falling: 25 points
- Secondary diagnosis: 15 points
- Ambulatory aid: None=0, Crutches=15, Furniture=30
- Gait: Normal=0, Weak=10, Impaired=20

CLINICAL MAPPING:
Always add clinicalMapping to vital signs and key clinical fields:
{{
  "id": "heart_rate",
  "type": "number",
  "label": "Heart Rate",
  "clinicalMapping": {{
    "observationType": "heart_rate",
    "loincCode": "8867-4",
    "unit": "bpm",
    "category": "vital-signs"
  }}
}}

PRIVACY & CONSENT:
- Mark sensitive fields (ABHA ID, contact) for encryption
- Include consent checkboxes for data sharing
- Add "Purpose of Collection" descriptions
- Enable "Right to be Forgotten" options

AUTO-CALCULATED FIELDS:
For clinical forms, suggest calculated fields:
- BMI: weight_kg / (height_m²)
- MAP: (SBP + 2*DBP) / 3
- Shock Index: HR / SBP
- BSA: √((height_cm × weight_kg) / 3600)

OUTPUT FORMAT: Same as general, but with healthcare context and suggestions.

BEST PRACTICES:
1. Always collect Patient ID or ABHA ID
2. Link to encounter context (visit date, provider)
3. Use LOINC-mapped fields for vitals
4. Include risk assessment when appropriate
5. Add consent tracking
6. Enable clinical decision support
7. Suggest risk rules based on form purpose
8. Use standardized clinical scales
"""

REFINEMENT_PROMPT_PREFIX = """
CURRENT FORM SCHEMA:
{current_schema}

USER REQUEST: {user_message}

INSTRUCTIONS:
- Modify ONLY what the user requests
- Preserve all other fields, pages, and configurations
- Maintain field IDs unless explicitly asked to change
- Keep existing clinical mappings unless asked to update
- Preserve risk rules unless asked to modify

Respond with explanation + updated schema in JSON.
"""

RISK_RULE_GENERATION_PROMPT = """
Based on the form schema below, generate appropriate risk scoring rules.

FORM SCHEMA:
{form_schema}

CLINICAL CONDITION (if specified): {clinical_condition}

Generate risk rules in this format:
{{
  "risk_rules": [
    {{
      "field_id": "respiratory_rate",
      "rule_type": "range",
      "condition": {{
        "normal": {{ "lower": 12, "upper": 20, "score": 0 }},
        "tachypnea": {{ "lower": 21, "upper": 24, "score": 2 }},
        "severe_tachypnea": {{ "lower": 25, "upper": 100, "score": 3 }}
      }}
    }}
  ],
  "risk_levels": [
    {{ "level_name": "Low", "min_score": 0, "max_score": 3, "color_code": "#10b981" }},
    {{ "level_name": "Moderate", "min_score": 4, "max_score": 6, "color_code": "#f59e0b" }},
    {{ "level_name": "High", "min_score": 7, "max_score": 9, "color_code": "#ef4444" }},
    {{ "level_name": "Critical", "min_score": 10, "max_score": 100, "color_code": "#dc2626" }}
  ],
  "explanation": "Explain why these rules were chosen"
}}

Consider:
- Clinical significance of values
- Standard thresholds (qSOFA, NEWS, MEWS)
- Severity escalation
- Evidence-based scoring
"""

CLINICAL_MAPPING_SUGGESTION_PROMPT = """
Review the fields in this form and suggest appropriate clinical mappings.

FORM SCHEMA:
{form_schema}

For each field that could be a clinical observation, suggest:
{{
  "suggestions": [
    {{
      "field_id": "blood_pressure_systolic",
      "suggested_mapping": {{
        "observationType": "bp_systolic",
        "loincCode": "8480-6",
        "unit": "mmHg",
        "category": "vital-signs"
      }},
      "confidence": "high",
      "reason": "Field label matches blood pressure systolic"
    }}
  ]
}}

Use LOINC codes from the infrastructure context. Only suggest mappings where confident.
"""
```

**Continue in next message...**

---

## 📊 Key Statistics

**Current Codebase:**
- 21 Field Types
- 7 Pre-defined Sections (Physiotherapy)
- 5 Form Templates
- Risk Scoring Infrastructure (3 models, 13 APIs)
- Clinical Integration (LOINC, SNOMED-CT, FHIR)
- Multi-page Form Support

**AI Integration:**
- 2 New Database Tables
- 7 New API Endpoints
- 5 New Frontend Components
- 4 New Backend Services
- 3 LLM Provider Integrations

**Total Lines of Code (Estimated):**
- Backend: ~2,500 lines
- Frontend: ~1,800 lines
- Documentation: ~1,200 lines
- **Total**: ~5,500 lines

---

### **PHASE 2: Backend Services & APIs (Week 2-3)**

#### 2.1 AI Service Layer

**New File**: `backend/app/ai/services.py`

```python
"""AI form generation services."""
from typing import Dict, List, Optional
import json
import time
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
from app import db

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
        llm = get_llm_provider(llm_provider, api_key, llm_model)
        if not llm.validate_api_key():
            return {'error': 'Invalid API key'}, 400

        # 2. Create or retrieve session
        session = AIFormSession.query.filter_by(
            user_id=user_id,
            status='active'
        ).first()

        if not session:
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
            sections = FieldSection.query.filter_by(is_system=True).all()
            section_context = "\n\nAVAILABLE FIELD SECTIONS:\n"
            for section in sections[:10]:  # Limit to avoid token bloat
                section_context += f"- {section.name} ({section.category}): {len(section.fields)} fields\n"
            system_prompt += section_context

        # Add refinement context if updating existing schema
        if current_schema:
            user_prompt = REFINEMENT_PROMPT_PREFIX.format(
                current_schema=json.dumps(current_schema, indent=2),
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
                prompt_sent=user_prompt,
                response_received=ai_response,
                tokens_used=tokens_used,
                latency_ms=latency_ms,
                success=True
            )
            db.session.add(log)

        except Exception as e:
            # Log failure
            log = AIGenerationLog(
                session_id=session.id,
                prompt_sent=user_prompt,
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
            return {'error': 'AI did not generate valid schema'}, 500

        # Validate against Form model
        is_valid, errors = SchemaValidator.validate_schema(schema)
        if not is_valid:
            return {'error': 'Generated schema is invalid', 'details': errors}, 500

        # 7. Update session
        session.current_schema = schema
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
    def generate_risk_rules(session_id: str, clinical_condition: Optional[str] = None) -> Dict:
        """Generate risk rules for form using AI."""
        session = AIFormSession.query.get(session_id)
        if not session or not session.current_schema:
            return {'error': 'Session not found'}, 404

        # Build prompt
        llm = get_llm_provider(session.llm_provider, "placeholder", session.llm_model)

        prompt = RISK_RULE_GENERATION_PROMPT.format(
            form_schema=json.dumps(session.current_schema, indent=2),
            clinical_condition=clinical_condition or "general clinical assessment"
        )

        messages = [
            {"role": "system", "content": "You are a clinical risk assessment expert."},
            {"role": "user", "content": prompt}
        ]

        try:
            response = llm.generate(messages, temperature=0.2, max_tokens=2000)
            risk_config = json.loads(response)

            return {
                'risk_rules': risk_config.get('risk_rules', []),
                'risk_levels': risk_config.get('risk_levels', []),
                'explanation': risk_config.get('explanation', '')
            }

        except Exception as e:
            return {'error': f'Risk rule generation failed: {str(e)}'}, 500

    @staticmethod
    def suggest_clinical_mappings(session_id: str) -> Dict:
        """Suggest clinical mappings for fields."""
        session = AIFormSession.query.get(session_id)
        if not session or not session.current_schema:
            return {'error': 'Session not found'}, 404

        llm = get_llm_provider(session.llm_provider, "placeholder", session.llm_model)

        prompt = CLINICAL_MAPPING_SUGGESTION_PROMPT.format(
            form_schema=json.dumps(session.current_schema, indent=2)
        )

        messages = [
            {"role": "system", "content": "You are a clinical data standards expert."},
            {"role": "user", "content": prompt}
        ]

        try:
            response = llm.generate(messages, temperature=0.1, max_tokens=1500)
            suggestions = json.loads(response)

            return {'suggestions': suggestions.get('suggestions', [])}

        except Exception as e:
            return {'error': f'Clinical mapping suggestion failed: {str(e)}'}, 500

    @staticmethod
    def finalize_form(session_id: str, form_name: Optional[str] = None,
                     form_description: Optional[str] = None, user_id: str = None) -> Dict:
        """Save AI-generated form to database."""
        session = AIFormSession.query.get(session_id)
        if not session or not session.current_schema:
            return {'error': 'Session not found'}, 404

        # Create Form
        form = Form(
            name=form_name or session.current_schema.get('name', 'AI Generated Form'),
            description=form_description or session.current_schema.get('description', ''),
            schema=session.current_schema,
            created_by=user_id,
            is_active=True,
            version=1
        )

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
            # Try to parse entire response as JSON
            json_str = ai_response.strip()

        try:
            schema = json.loads(json_str)
            return schema
        except:
            return None

class SchemaValidator:
    """Validate generated schema against Form model."""

    @staticmethod
    def validate_schema(schema: Dict) -> tuple[bool, List[str]]:
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

        # Collect all fields
        all_fields = []
        if has_pages:
            for page in form_schema['pages']:
                all_fields.extend(page.get('fields', []))
        else:
            all_fields = form_schema.get('fields', [])

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

        return len(errors) == 0, errors

class SuggestionEngine:
    """Generate next-step suggestions."""

    @staticmethod
    def generate_suggestions(schema: Dict, mode: str) -> List[str]:
        """Generate contextual suggestions."""
        suggestions = []

        # Extract all fields
        all_fields = []
        if 'pages' in schema.get('schema', {}):
            for page in schema['schema']['pages']:
                all_fields.extend(page.get('fields', []))
        else:
            all_fields = schema.get('schema', {}).get('fields', [])

        field_types = [f.get('type') for f in all_fields]
        field_labels = [f.get('label', '').lower() for f in all_fields]

        if mode == 'healthcare':
            # Check for vital signs
            has_vitals = any(label in ['blood pressure', 'heart rate', 'temperature']
                           for label in field_labels)
            if not has_vitals:
                suggestions.append("💡 Add vital signs section (BP, HR, Temp, SpO2)")

            # Check for risk scoring
            has_risk_display = 'riskScoreDisplay' in field_types
            if not has_risk_display:
                suggestions.append("⚠️ Add risk score display field for real-time risk calculation")

            # Check for clinical mapping
            fields_with_mapping = [f for f in all_fields if 'clinicalMapping' in f]
            if len(fields_with_mapping) < len([f for f in all_fields if f.get('type') in ['number', 'numeric']]):
                suggestions.append("🏥 Add LOINC clinical mappings to vital sign fields")

        # General suggestions
        if len(all_fields) > 15 and 'pages' not in schema.get('schema', {}):
            suggestions.append("📄 Consider splitting into multiple pages for better UX")

        return suggestions[:5]  # Limit to 5 suggestions
```

#### 2.2 API Routes

**New File**: `backend/app/ai/routes.py`

```python
"""AI form builder API endpoints."""
from flask import Blueprint, request, jsonify
from app.auth.decorators import require_permission
from app.auth.utils import get_current_user
from app.ai.services import AIFormService

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/ai-forms/generate', methods=['POST'])
@require_permission('create_form')
def generate_form():
    """
    Generate or refine form using AI.

    Request Body:
    {
      "llm_provider": "openai",
      "llm_model": "gpt-4-turbo",
      "api_key": "sk-...",
      "mode": "healthcare",
      "user_message": "Create a sepsis screening form",
      "conversation_history": [],
      "current_schema": null
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
      "user_message": "Make email field required"
    }
    """
    data = request.json
    user = get_current_user()

    # Reuse generate_form with session context
    session = AIFormSession.query.get(data['session_id'])
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    result = AIFormService.generate_form(
        user_id=user.id,
        llm_provider=session.llm_provider,
        llm_model=session.llm_model,
        api_key=data.get('api_key'),  # User must provide API key again
        mode=session.mode,
        user_message=data['user_message'],
        conversation_history=session.conversation_history,
        current_schema=session.current_schema
    )

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 200

@ai_bp.route('/ai-forms/suggest-risk', methods=['POST'])
@require_permission('create_form')
def suggest_risk_rules():
    """
    Generate risk rules for form.

    Request Body:
    {
      "session_id": "uuid",
      "clinical_condition": "sepsis"
    }

    Response:
    {
      "risk_rules": [...],
      "risk_levels": [...],
      "explanation": "..."
    }
    """
    data = request.json

    result = AIFormService.generate_risk_rules(
        session_id=data['session_id'],
        clinical_condition=data.get('clinical_condition')
    )

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 200

@ai_bp.route('/ai-forms/suggest-clinical', methods=['POST'])
@require_permission('create_form')
def suggest_clinical_mappings():
    """
    Suggest clinical mappings for fields.

    Request Body:
    {
      "session_id": "uuid"
    }

    Response:
    {
      "suggestions": [
        {
          "field_id": "blood_pressure",
          "suggested_mapping": {...},
          "confidence": "high",
          "reason": "..."
        }
      ]
    }
    """
    data = request.json

    result = AIFormService.suggest_clinical_mappings(
        session_id=data['session_id']
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
      "form_name": "Sepsis Screening Form",
      "form_description": "..."
    }

    Response:
    {
      "form_id": "uuid",
      "message": "Form created successfully"
    }
    """
    data = request.json
    user = get_current_user()

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
    """Retrieve AI form session."""
    session = AIFormSession.query.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    return jsonify({
        'session': {
            'id': str(session.id),
            'mode': session.mode,
            'status': session.status,
            'conversation_history': session.conversation_history,
            'current_schema': session.current_schema,
            'created_at': session.created_at.isoformat(),
            'form_id': str(session.form_id) if session.form_id else None
        }
    }), 200

@ai_bp.route('/ai-forms/sessions/<session_id>', methods=['DELETE'])
@require_permission('create_form')
def abandon_session(session_id):
    """Abandon AI form session."""
    session = AIFormSession.query.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    session.status = 'abandoned'
    db.session.commit()

    return jsonify({'message': 'Session abandoned'}), 200
```

**Register Blueprint**: Update `backend/app/__init__.py`

```python
from app.ai.routes import ai_bp

app.register_blueprint(ai_bp, url_prefix='/api')
```

---

### **PHASE 3: Frontend Components (Week 3-4)**

#### 3.1 Component Structure

```
frontend/src/components/ai/
├── AIFormBuilderModal.jsx          # Main modal container
├── LLMConfigStep.jsx                # Step 1: Provider & API key
├── ConversationStep.jsx             # Step 2: Chat + Preview
├── AIChat.jsx                       # Chat interface
├── FormPreview.jsx                  # Live form preview
├── ConversationHistory.jsx          # Sidebar with history
├── AILoadingIndicator.jsx           # Animated loading
├── SuggestionChips.jsx              # Action suggestions
└── RiskRulePreview.jsx              # Preview generated risk rules

frontend/src/api/
└── ai-forms.js                      # API client

frontend/src/hooks/
└── useAIFormBuilder.js              # State management hook
```

#### 3.2 Main Modal Component

**File**: `frontend/src/components/ai/AIFormBuilderModal.jsx`

```jsx
import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import LLMConfigStep from './LLMConfigStep';
import ConversationStep from './ConversationStep';
import aiFormsApi from '../../api/ai-forms';

export default function AIFormBuilderModal({ isOpen, onClose, mode = 'general' }) {
  const [step, setStep] = useState(1); // 1: Config, 2: Conversation
  const [llmConfig, setLLMConfig] = useState({
    provider: 'openai',
    model: 'gpt-4-turbo',
    apiKey: ''
  });
  const [session, setSession] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentSchema, setCurrentSchema] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStartSession = (config) => {
    setLLMConfig(config);
    setStep(2);
  };

  const handleSendMessage = async (message) => {
    setIsGenerating(true);

    try {
      const response = await aiFormsApi.generate({
        llm_provider: llmConfig.provider,
        llm_model: llmConfig.model,
        api_key: llmConfig.apiKey,
        mode: mode,
        user_message: message,
        conversation_history: conversation,
        current_schema: currentSchema
      });

      setSession(response);
      setConversation([
        ...conversation,
        { role: 'user', content: message },
        { role: 'assistant', content: response.message }
      ]);
      setCurrentSchema(response.schema);

    } catch (error) {
      alert('Failed to generate: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    try {
      const result = await aiFormsApi.finalize({
        session_id: session.session_id,
        form_name: currentSchema.name,
        form_description: currentSchema.description
      });

      alert('Form created successfully!');
      onClose();
      window.location.href = `/forms/${result.form_id}/edit`;

    } catch (error) {
      alert('Failed to save form: ' + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-6xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  AI Form Builder
                </h2>
                <p className="text-sm text-gray-600">
                  {mode === 'healthcare' ? '🏥 Healthcare Mode' : '📝 General Mode'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[600px]">
            {step === 1 && (
              <LLMConfigStep
                initialConfig={llmConfig}
                onNext={handleStartSession}
              />
            )}

            {step === 2 && (
              <ConversationStep
                conversation={conversation}
                currentSchema={currentSchema}
                session={session}
                isGenerating={isGenerating}
                onSendMessage={handleSendMessage}
                onFinalize={handleFinalize}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 3.3 API Client

**File**: `frontend/src/api/ai-forms.js`

```javascript
import axios from 'axios';

const API_BASE = '/api';

const aiFormsApi = {
  generate: async (data) => {
    const response = await axios.post(`${API_BASE}/ai-forms/generate`, data);
    return response.data;
  },

  refine: async (sessionId, message, apiKey) => {
    const response = await axios.post(`${API_BASE}/ai-forms/refine`, {
      session_id: sessionId,
      user_message: message,
      api_key: apiKey
    });
    return response.data;
  },

  suggestRiskRules: async (sessionId, clinicalCondition = null) => {
    const response = await axios.post(`${API_BASE}/ai-forms/suggest-risk`, {
      session_id: sessionId,
      clinical_condition: clinicalCondition
    });
    return response.data;
  },

  suggestClinicalMappings: async (sessionId) => {
    const response = await axios.post(`${API_BASE}/ai-forms/suggest-clinical`, {
      session_id: sessionId
    });
    return response.data;
  },

  finalize: async (data) => {
    const response = await axios.post(`${API_BASE}/ai-forms/finalize`, data);
    return response.data;
  },

  getSession: async (sessionId) => {
    const response = await axios.get(`${API_BASE}/ai-forms/sessions/${sessionId}`);
    return response.data;
  },

  abandonSession: async (sessionId) => {
    const response = await axios.delete(`${API_BASE}/ai-forms/sessions/${sessionId}`);
    return response.data;
  }
};

export default aiFormsApi;
```

#### 3.4 Integration with FormsList

**Update**: `frontend/src/pages/forms/FormsList.jsx`

Add buttons in the header section:

```jsx
import AIFormBuilderModal from '../../components/ai/AIFormBuilderModal';

export default function FormsList() {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiMode, setAIMode] = useState('general');

  // ... existing code ...

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Forms</h1>
          <p className="text-gray-600 mt-1">Create and manage form templates</p>
        </div>
        
        {canCreateForm && (
          <div className="flex items-center gap-3">
            {/* AI Buttons */}
            <button
              onClick={() => { setAIMode('general'); setShowAIModal(true); }}
              className="btn-secondary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              🤖 AI General
            </button>
            <button
              onClick={() => { setAIMode('healthcare'); setShowAIModal(true); }}
              className="btn-primary flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700"
            >
              <Sparkles className="w-4 h-4" />
              🏥 AI Healthcare
            </button>

            {/* Existing buttons */}
            <button onClick={() => setShowTemplateBrowser(true)} className="btn-secondary">
              <Layers className="w-4 h-4" />
              Browse Templates
            </button>
            <Link to="/forms/new" className="btn-ghost">
              <Plus className="w-4 h-4" />
              Manual Create
            </Link>
          </div>
        )}
      </div>

      {/* ... existing code ... */}

      {/* AI Modal */}
      <AIFormBuilderModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        mode={aiMode}
      />
    </div>
  );
}
```

---

## 🎭 User Experience Flows

### Scenario 1: General Event Form

```
User clicks: "🤖 AI General"

Step 1: LLM Configuration
  [Provider: OpenAI ▼]
  [Model: GPT-4 Turbo ▼]
  [API Key: sk-proj-****...]
  [Validate & Continue]

Step 2: Conversation
  User: "Create a tech conference registration form"

  AI: "I'll create a conference registration form with:
       • Personal Information (name, email, phone)
       • Organization Details
       • Ticket Type Selection
       • Dietary Preferences
       • T-shirt Size"

  [Preview shows form with 3 pages, 12 fields]

  💡 Suggestions:
     - Add accommodation preferences
     - Include session selection

  User: "Add a field for dietary restrictions"

  AI: "Added dietary restrictions as a textarea field
       with placeholder for allergies/preferences"

  [Preview updates instantly]

  User: "Perfect!"

  [🚀 Create Form] [✏️ Continue in Manual Editor]
```

### Scenario 2: Healthcare Sepsis Screening

```
User clicks: "🏥 AI Healthcare"

Step 1: LLM Configuration (same as above)

Step 2: Conversation
  User: "Create sepsis screening form for emergency department"

  AI: "I'll create an ABDM-compliant sepsis screening form
       using qSOFA criteria:

       📋 Page 1: Patient Information
          • ABHA ID (required, LOINC mapped)
          • Demographics (age, gender)

       🏥 Page 2: Vital Signs (all LOINC-coded)
          • Blood Pressure (8480-6, 8462-4)
          • Heart Rate (8867-4)
          • Respiratory Rate (9279-1)
          • Temperature (8310-5)
          • SpO2 (2708-6)

       🧠 Page 3: Clinical Assessment
          • Mental Status (AVPU scale)
          • Skin Assessment

       ⚠️ Page 4: Risk Score
          • qSOFA Score (auto-calculated)
          • Risk Level Display (color-coded)

       ✅ Risk Rules Generated:
          - RR >= 22: +1 point
          - SBP <= 100: +1 point
          - Altered mental status: +1 point
          - Total >= 2: HIGH RISK"

  [Preview shows complete 4-page form with risk display]

  💡 Suggestions:
     - Add lactate level field
     - Include sepsis bundle checklist
     - Generate NEWS2 score

  User: "Add lactate level"

  AI: "Added lactate field:
       • Type: Number
       • LOINC: 2524-7
       • Unit: mmol/L
       • Normal Range: 0.5-2.0
       • Risk Rule: >2.0 = +1 point"

  [Preview updates with new field]

  User: "Generate the form with risk rules"

  [🚀 Create Form & Risk Rules]

  → Form saved with:
     ✅ 18 fields
     ✅ 4 risk rules configured
     ✅ 4 risk levels (Low/Moderate/High/Critical)
     ✅ All clinical mappings applied
```

---

## 📊 Implementation Timeline

### Week 1-2: Foundation
- [ ] Database migrations (ai_form_sessions, ai_generation_logs)
- [ ] LLM provider abstraction (OpenAI, Anthropic, Gemini)
- [ ] System prompts (general + healthcare)
- [ ] Schema extractor and validator
- [ ] Backend AI service layer skeleton

### Week 3: Backend APIs
- [ ] /generate endpoint with full logic
- [ ] /refine endpoint
- [ ] /suggest-risk endpoint
- [ ] /suggest-clinical endpoint
- [ ] /finalize endpoint
- [ ] Session management endpoints
- [ ] Integration testing

### Week 4: Frontend Core
- [ ] AIFormBuilderModal skeleton
- [ ] LLMConfigStep component
- [ ] ConversationStep component
- [ ] AIChat component
- [ ] FormPreview component
- [ ] API client integration

### Week 5: Frontend Polish
- [ ] ConversationHistory sidebar
- [ ] SuggestionChips component
- [ ] RiskRulePreview component
- [ ] Loading states and animations
- [ ] Error handling UI
- [ ] Toast notifications

### Week 6: Integration & Testing
- [ ] Integrate with FormsList (AI buttons)
- [ ] Integrate with FormBuilder (edit existing)
- [ ] End-to-end testing
- [ ] UX refinements
- [ ] Documentation

### Week 7-8: Advanced Features
- [ ] Risk rule generation with AI
- [ ] Clinical mapping suggestions
- [ ] Section-level editing ("Add vital signs section")
- [ ] Field-level refinement
- [ ] Template awareness (suggest from existing templates)
- [ ] Analytics dashboard (token usage, success rates)

---

## 💰 Cost Analysis

### Token Usage Estimates

**Per Form Generation:**
- Initial generation: 3,500-5,000 tokens
- Refinement (avg 3 iterations): 3,000 tokens
- Risk rule generation: 1,500 tokens
- Clinical mapping: 1,000 tokens
- **Average Total**: ~12,000 tokens per form

**Pricing (per form):**
- GPT-4 Turbo: $0.18
- Claude 3.5 Sonnet: $0.14
- Gemini Pro: $0.09

### Business Model Options

**Option 1: Free Tier + Usage**
- 5 free AI generations per user/month
- $0.25 per generation after
- Profit margin: ~40%

**Option 2: Subscription**
- Basic: $19/month (20 generations)
- Pro: $49/month (100 generations)
- Enterprise: $199/month (unlimited)

**Option 3: Bring Your Own Key**
- Users provide their own API keys
- No cost to platform
- Premium feature for paid plans

**Recommendation**: Option 3 (BYOK) for MVP, then Option 2 for scale.

---

## 🔒 Security Considerations

### API Key Handling
- ❌ **NEVER** store user API keys in database
- ✅ Use in-memory only for session duration
- ✅ Encrypt in transit (HTTPS)
- ✅ Optional: Allow users to save encrypted keys in their account

### Data Privacy
- AI sessions contain form schemas (may include PHI)
- Log only metadata, not actual form content
- Auto-delete abandoned sessions after 24 hours
- GDPR compliance: Right to delete AI sessions

### Rate Limiting
- 10 requests per hour per user (free tier)
- 100 requests per hour (paid tier)
- Per-IP rate limiting to prevent abuse

### Input Validation
- Sanitize all user messages
- Validate generated schemas before saving
- Prevent prompt injection attacks
- Token budget limits (50,000 tokens/month free tier)

---

## 🚀 Go-to-Market Strategy

### Positioning
**"The Only AI Form Builder That Speaks Healthcare"**

### Target Audiences
1. **Primary**: Indian hospitals/clinics needing ABDM compliance
2. **Secondary**: Clinical research teams
3. **Tertiary**: Event organizers, HR departments

### Key Messages
- "Generate ABDM-compliant forms in 60 seconds"
- "AI that understands qSOFA, LOINC, and FHIR"
- "Your AI, your rules - bring your own API key"
- "Conversational refinement, not one-shot generation"

### Marketing Assets
1. **Demo Video**: "Build Sepsis Screening Form in 60 Seconds"
2. **Blog Post**: "Why Generic Form Builders Fail at Healthcare"
3. **Case Study**: "How [Hospital X] Cut Form Creation Time by 85%"
4. **Webinar**: "AI-Powered Clinical Decision Support"

---

## 📈 Success Metrics

### Adoption
- 50% of new forms created with AI within 3 months
- Average 4.2 refinement iterations per form
- 80% user satisfaction score

### Technical
- <3 seconds average response latency
- 95% schema validation success rate
- <5% error rate in LLM calls

### Clinical Value
- 90% of generated forms include risk scoring
- 75% of vital signs auto-mapped to LOINC
- 60% include auto-calculated fields

### Business
- 30% conversion from free to paid tier
- Average token usage: 15,000 per user/month
- $0.15 average cost per generation

---

## 🎯 Competitive Advantages

| Feature | Generic Form Builders | CV Raman Health AI |
|---------|----------------------|---------------------|
| Conversational Refinement | ❌ One-shot only | ✅ Iterative conversation |
| Healthcare Intelligence | ❌ No medical knowledge | ✅ ABDM, FHIR, LOINC aware |
| Risk Rule Generation | ❌ Manual only | ✅ AI-generated qSOFA, NEWS |
| Clinical Mapping | ❌ Not available | ✅ Auto-suggest LOINC codes |
| Field Section Awareness | ❌ No context | ✅ Suggests from existing sections |
| Bring Your Own LLM | ❌ Locked to vendor AI | ✅ OpenAI/Claude/Gemini choice |
| Multi-page Forms | ⚠️ Limited | ✅ Full support |
| Auto-calculated Fields | ❌ Not available | ✅ BMI, MAP, BSA formulas |

---

## 📝 Dependencies

### Python Packages
```txt
# Add to backend/requirements.txt
openai==1.12.0
anthropic==0.18.1
google-generativeai==0.3.2
tiktoken==0.6.0
```

### NPM Packages
```json
// Add to frontend/package.json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "prismjs": "^1.29.0"
  }
}
```

### Environment Variables
```bash
# backend/.env

# Optional fallback API keys (for demo/testing)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Rate limiting
AI_GENERATION_RATE_LIMIT=10  # per hour per user
AI_TOKEN_BUDGET_PER_USER=50000  # per month

# Session management
AI_SESSION_TIMEOUT_HOURS=24
AI_SESSION_CLEANUP_ENABLED=true
```

---

## ✅ Acceptance Criteria

### MVP Ready When:
- [ ] User can generate form from natural language
- [ ] User can refine form through conversation
- [ ] Preview updates in real-time
- [ ] Healthcare mode suggests LOINC codes
- [ ] Healthcare mode generates risk rules for qSOFA
- [ ] Form can be saved to database
- [ ] User can continue editing in manual builder
- [ ] All 21 field types supported
- [ ] Multi-page forms work correctly
- [ ] Auto-calculated fields preserved
- [ ] Error handling graceful and informative
- [ ] Documentation complete

---

## 🎉 Summary

This plan leverages CV Raman Health's **existing infrastructure** to build a world-class AI form builder that's:

✅ **Healthcare-First** - Understands ABDM, FHIR, LOINC, risk scoring  
✅ **Conversational** - Iterative refinement, not one-shot  
✅ **Privacy-Focused** - Bring Your Own LLM key  
✅ **Production-Ready** - Builds on proven field types, risk system, clinical mapping  
✅ **Differentiated** - No competitor has this healthcare intelligence  

**Estimated Effort**: 6-8 weeks for full implementation  
**Lines of Code**: ~5,500 lines (backend + frontend + docs)  
**Cost per Form**: ~$0.10-$0.20 (with BYOK: $0)  

---

**Ready to revolutionize healthcare forms?** 🚀

