# 🤖 AI-Powered Form Builder - Comprehensive Implementation Plan

## 🎯 Vision: The World's First Conversational Healthcare Form Builder

**Unique Selling Proposition:**
- **Iterative AI Collaboration**: Not just "generate and done" - users can refine forms through natural conversation
- **Dual Mode**: General forms + Healthcare-compliant forms with ABDM/FHIR awareness
- **Bring Your Own LLM**: Support multiple AI providers (OpenAI, Anthropic, Gemini, local models)
- **Context-Aware**: AI understands your field types, risk rules, and healthcare standards
- **Smart Sections**: Generate/edit entire sections or individual fields conversationally

---

## 🏗️ Architecture Overview

### Frontend Architecture
```
┌─────────────────────────────────────────────────────────┐
│ Forms List Page                                          │
│ ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│ │ + New Form  │  │ 🤖 AI General   │  │ 🏥 AI Health │ │
│ └─────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ AI Form Builder Modal                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Step 1: LLM Selection & API Key                     │ │
│ │ [OpenAI GPT-4] [Anthropic Claude] [Google Gemini]  │ │
│ │ API Key: ****************************               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Step 2: Describe Your Form                          │ │
│ │ 💬 Chat Interface with AI                           │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ User: Create a patient intake form             │ │ │
│ │ │ AI: I'll create a form with sections for...    │ │ │
│ │ │ User: Add risk scoring for sepsis              │ │ │
│ │ │ AI: Added risk rules for sepsis criteria...    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Step 3: Live Preview & Refinement                  │ │
│ │ ┌──────────────┐  ┌─────────────────────────────┐  │ │
│ │ │ Form Preview │  │ Continue chatting to refine │  │ │
│ │ │ [Live form]  │  │ "Make age required"         │  │ │
│ │ │              │  │ "Add BMI calculator"        │  │ │
│ │ └──────────────┘  └─────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [🚀 Create Form] [✏️ Continue in Manual Editor]         │
└─────────────────────────────────────────────────────────┘
```

### Backend Architecture
```
┌──────────────────────────────────────────┐
│ /api/ai-forms/*                          │
├──────────────────────────────────────────┤
│ POST /api/ai-forms/generate              │ ← Initial generation
│ POST /api/ai-forms/refine                │ ← Iterative updates
│ POST /api/ai-forms/add-section           │ ← Add new section
│ POST /api/ai-forms/edit-field            │ ← Modify specific field
│ POST /api/ai-forms/validate              │ ← Validate with AI
│ POST /api/ai-forms/suggest-risk-rules    │ ← Generate risk rules
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ AI Service Layer (NEW)                   │
├──────────────────────────────────────────┤
│ • LLM Provider Abstraction               │
│ • System Prompt Manager                  │
│ • Schema Validator                       │
│ • Context Builder                        │
│ • Conversation History Manager           │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ External LLM APIs                        │
├──────────────────────────────────────────┤
│ • OpenAI (GPT-4, GPT-3.5)               │
│ • Anthropic (Claude 3.5 Sonnet/Haiku)   │
│ • Google (Gemini Pro/Flash)             │
│ • Local (Ollama, LM Studio)             │
└──────────────────────────────────────────┘
```

---

## 📋 Detailed Implementation Plan

### **PHASE 1: Foundation (Week 1-2)**

#### 1.1 Backend - AI Service Infrastructure

**New Files to Create:**

**`backend/app/ai/` (NEW MODULE)**
```python
# backend/app/ai/__init__.py
# backend/app/ai/models.py          # Database models for AI sessions
# backend/app/ai/routes.py          # API endpoints
# backend/app/ai/services.py        # Business logic
# backend/app/ai/llm_providers.py   # LLM abstraction layer
# backend/app/ai/prompts.py         # System prompts
# backend/app/ai/schema_generator.py # Form schema generation
# backend/app/ai/validators.py      # AI output validation
```

**Database Models:**
```python
# backend/app/ai/models.py

class AIFormSession(BaseModel):
    """Track AI form building sessions"""
    __tablename__ = 'ai_form_sessions'

    user_id = Column(UUID, ForeignKey('users.id'))
    llm_provider = Column(String(50))  # 'openai', 'anthropic', 'gemini'
    llm_model = Column(String(100))    # 'gpt-4', 'claude-3.5-sonnet'
    mode = Column(String(20))          # 'general', 'healthcare'
    conversation_history = Column(JSONB)  # Full chat history
    current_schema = Column(JSONB)     # Latest form schema
    form_id = Column(UUID, ForeignKey('forms.id'), nullable=True)
    status = Column(String(20))        # 'active', 'completed', 'abandoned'
    created_at = Column(DateTime)
    completed_at = Column(DateTime)

class AIGenerationLog(BaseModel):
    """Log all AI interactions for debugging/improvement"""
    __tablename__ = 'ai_generation_logs'

    session_id = Column(UUID, ForeignKey('ai_form_sessions.id'))
    prompt_sent = Column(Text)
    response_received = Column(Text)
    tokens_used = Column(Integer)
    latency_ms = Column(Integer)
    success = Column(Boolean)
    error_message = Column(Text)
```

**LLM Provider Abstraction:**
```python
# backend/app/ai/llm_providers.py

from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    def generate(self, messages, temperature=0.7, max_tokens=4000):
        pass

    @abstractmethod
    def validate_api_key(self, api_key):
        pass

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key, model='gpt-4-turbo'):
        self.api_key = api_key
        self.model = model
        self.client = OpenAI(api_key=api_key)

    def generate(self, messages, temperature=0.7, max_tokens=4000):
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content

class AnthropicProvider(LLMProvider):
    # Similar implementation for Claude

class GeminiProvider(LLMProvider):
    # Similar implementation for Gemini

def get_llm_provider(provider_name, api_key, model=None):
    """Factory function"""
    providers = {
        'openai': OpenAIProvider,
        'anthropic': AnthropicProvider,
        'gemini': GeminiProvider
    }
    return providers[provider_name](api_key, model)
```

**System Prompts:**
```python
# backend/app/ai/prompts.py

GENERAL_FORM_SYSTEM_PROMPT = """You are an expert form builder AI. Your task is to create well-structured forms based on user requirements.

AVAILABLE FIELD TYPES:
- text: Single-line text input
- numeric: Numbers (can allow decimals)
- email: Email validation
- phone: Phone with country code
- date, time: Date/time pickers
- select, radio: Options-based selection
- checkbox: Boolean toggle
- textarea: Multi-line text
- linearScale: Rating scale (1-5, 1-10, etc.)
- painScale: Medical 0-10 pain scale
- file: File upload
- url: Website URL
- section: Visual divider

FORM SCHEMA FORMAT:
{
  "name": "Form Name",
  "description": "Form description",
  "schema": {
    "pages": [
      {
        "id": "page_1",
        "title": "Page Title",
        "fields": [
          {
            "id": "field_unique_id",
            "type": "text",
            "label": "Field Label",
            "required": true,
            "placeholder": "Enter...",
            "validation": {"min": 0, "max": 100}
          }
        ]
      }
    ]
  }
}

RULES:
1. Always generate valid JSON matching the schema above
2. Use descriptive field labels
3. Add helpful placeholders
4. Set appropriate validation rules
5. Generate unique field IDs (use: field_XXX format)
6. Group related fields into logical pages
7. Add conditional logic (visibilityRules) when appropriate

When user asks to modify, ONLY change the requested parts while preserving the rest.
"""

HEALTHCARE_FORM_SYSTEM_PROMPT = """You are a specialized healthcare form builder AI with deep knowledge of ABDM, FHIR R4, and clinical best practices.

ADDITIONAL HEALTHCARE FIELD TYPES:
- painScale: 0-10 pain scale with emoji faces
- severityRating: Color-coded severity (None→Critical)
- symptomChecklist: Multi-symptom with severity sub-ratings
- functionalStatus: ECOG/Karnofsky/ADL scales
- riskScoreDisplay: Real-time calculated risk score

HEALTHCARE STANDARDS:
- ABDM (Ayushman Bharat Digital Mission) compliance
- FHIR R4 resource mapping
- LOINC codes for observations
- ICD-10 for diagnoses
- DPDPA 2023 for data privacy
- HIPAA best practices

CLINICAL CONSIDERATIONS:
1. Always collect Patient ID/ABHA ID
2. Link to encounter context
3. Use LOINC-mapped vitals (BP, HR, Temp, SpO2, RR)
4. Include chief complaint
5. Add risk assessment when appropriate
6. Use standardized clinical scales
7. Enable consent tracking
8. Maintain audit trails

RISK RULE GENERATION:
When creating forms for clinical assessment, automatically suggest risk rules:
- Vital sign thresholds (tachycardia, hypotension, fever)
- Sepsis criteria (qSOFA, SIRS)
- Early warning scores (NEWS, MEWS)
- Disease-specific scoring (CHADS2-VASc, CHA2DS2-VASc)

PRIVACY:
- Mark sensitive fields for encryption
- Add consent checkboxes
- Enable data minimization
- Support right to be forgotten

Generate forms that are clinically accurate, ABDM-compliant, and user-friendly.
"""
```

#### 1.2 Frontend - AI Form Builder Component

**New Files to Create:**

```
frontend/src/components/ai/
├── AIFormBuilderModal.jsx        # Main modal container
├── LLMSelector.jsx                # Select provider & enter API key
├── AIChat.jsx                     # Chat interface component
├── FormPreview.jsx                # Live form preview
├── ConversationHistory.jsx        # Show chat history
└── AILoadingIndicator.jsx         # Animated loading states

frontend/src/api/
└── ai-forms.js                    # API client for AI endpoints

frontend/src/hooks/
└── useAIFormBuilder.js            # Custom hook for state management
```

**Key Component Structure:**
```jsx
// frontend/src/components/ai/AIFormBuilderModal.jsx

export default function AIFormBuilderModal({ isOpen, onClose, mode }) {
  const [step, setStep] = useState(1); // 1: LLM Setup, 2: Chat, 3: Review
  const [llmConfig, setLLMConfig] = useState({
    provider: 'openai',
    model: 'gpt-4-turbo',
    apiKey: ''
  });
  const [conversation, setConversation] = useState([]);
  const [currentSchema, setCurrentSchema] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (userMessage) => {
    setIsGenerating(true);
    const response = await aiFormsApi.generate({
      llm_provider: llmConfig.provider,
      llm_model: llmConfig.model,
      api_key: llmConfig.apiKey,
      mode: mode, // 'general' or 'healthcare'
      user_message: userMessage,
      conversation_history: conversation,
      current_schema: currentSchema
    });

    setConversation([...conversation,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.message }
    ]);
    setCurrentSchema(response.schema);
    setIsGenerating(false);
  };

  // ... rest of implementation
}
```

---

### **PHASE 2: Core AI Features (Week 3-4)**

#### 2.1 Backend API Endpoints

**`backend/app/ai/routes.py`**

```python
from flask import Blueprint, request, jsonify
from app.ai.services import AIFormService
from app.auth.decorators import require_permission

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/ai-forms/generate', methods=['POST'])
@require_permission('create_form')
def generate_form():
    """
    Initial form generation from user description

    Request:
    {
      "llm_provider": "openai",
      "llm_model": "gpt-4-turbo",
      "api_key": "sk-...",
      "mode": "healthcare",  # or "general"
      "user_message": "Create a patient intake form with vitals",
      "conversation_history": [],
      "current_schema": null
    }

    Response:
    {
      "session_id": "uuid",
      "message": "AI response",
      "schema": {...},  # Generated form schema
      "suggestions": ["Add BMI calculator", "Include allergies section"]
    }
    """
    data = request.json
    result = AIFormService.generate_form(
        user_id=get_current_user().id,
        llm_provider=data['llm_provider'],
        llm_model=data.get('llm_model'),
        api_key=data['api_key'],
        mode=data.get('mode', 'general'),
        user_message=data['user_message'],
        conversation_history=data.get('conversation_history', []),
        current_schema=data.get('current_schema')
    )
    return jsonify(result), 200

@ai_bp.route('/ai-forms/refine', methods=['POST'])
@require_permission('create_form')
def refine_form():
    """
    Iterative refinement of existing schema

    Examples:
    - "Make the email field required"
    - "Add a section for medical history"
    - "Change pain scale to 5-point instead of 10-point"
    """
    data = request.json
    result = AIFormService.refine_form(
        session_id=data['session_id'],
        user_message=data['user_message']
    )
    return jsonify(result), 200

@ai_bp.route('/ai-forms/add-section', methods=['POST'])
@require_permission('create_form')
def add_section():
    """
    Add a new section to existing form

    Request:
    {
      "session_id": "uuid",
      "section_description": "Add vital signs section with BP, HR, Temp, SpO2"
    }
    """
    data = request.json
    result = AIFormService.add_section(
        session_id=data['session_id'],
        section_description=data['section_description']
    )
    return jsonify(result), 200

@ai_bp.route('/ai-forms/suggest-risk-rules', methods=['POST'])
@require_permission('create_form')
def suggest_risk_rules():
    """
    AI suggests risk rules based on form fields

    Example: For sepsis screening form, suggest qSOFA criteria
    """
    data = request.json
    result = AIFormService.suggest_risk_rules(
        session_id=data['session_id'],
        clinical_condition=data.get('clinical_condition')
    )
    return jsonify(result), 200

@ai_bp.route('/ai-forms/finalize', methods=['POST'])
@require_permission('create_form')
def finalize_form():
    """
    Save AI-generated form to database

    Response:
    {
      "form_id": "uuid",
      "message": "Form created successfully"
    }
    """
    data = request.json
    result = AIFormService.finalize_form(
        session_id=data['session_id'],
        form_name=data.get('form_name'),
        form_description=data.get('form_description')
    )
    return jsonify(result), 201
```

#### 2.2 Backend Service Logic

**`backend/app/ai/services.py`**

```python
class AIFormService:

    @staticmethod
    def generate_form(user_id, llm_provider, api_key, mode, user_message,
                      llm_model=None, conversation_history=[], current_schema=None):
        """Generate or refine form using AI"""

        # 1. Validate API key
        llm = get_llm_provider(llm_provider, api_key, llm_model)
        if not llm.validate_api_key(api_key):
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
                llm_model=llm_model or llm.default_model,
                mode=mode,
                conversation_history=[],
                current_schema=current_schema,
                status='active'
            )
            db.session.add(session)

        # 3. Build prompt
        system_prompt = (HEALTHCARE_FORM_SYSTEM_PROMPT
                        if mode == 'healthcare'
                        else GENERAL_FORM_SYSTEM_PROMPT)

        # Add context about current schema if refining
        context = ""
        if current_schema:
            context = f"\n\nCURRENT FORM SCHEMA:\n{json.dumps(current_schema, indent=2)}\n\nPlease modify ONLY what the user requests while preserving the rest."

        messages = [
            {"role": "system", "content": system_prompt + context}
        ]

        # Add conversation history
        for msg in conversation_history:
            messages.append(msg)

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # 4. Call LLM
        start_time = time.time()
        try:
            ai_response = llm.generate(messages, temperature=0.3)
            latency_ms = int((time.time() - start_time) * 1000)

            # Log the interaction
            log = AIGenerationLog(
                session_id=session.id,
                prompt_sent=user_message,
                response_received=ai_response,
                latency_ms=latency_ms,
                success=True
            )
            db.session.add(log)

        except Exception as e:
            log = AIGenerationLog(
                session_id=session.id,
                prompt_sent=user_message,
                response_received=None,
                success=False,
                error_message=str(e)
            )
            db.session.add(log)
            db.session.commit()
            return {'error': f'LLM generation failed: {str(e)}'}, 500

        # 5. Extract JSON schema from response
        schema = SchemaGenerator.extract_schema_from_text(ai_response)

        if not schema:
            return {'error': 'AI did not generate valid schema'}, 500

        # 6. Validate schema
        is_valid, errors = SchemaValidator.validate(schema)
        if not is_valid:
            return {'error': 'Generated schema is invalid', 'details': errors}, 500

        # 7. Update session
        session.current_schema = schema
        session.conversation_history.append({"role": "user", "content": user_message})
        session.conversation_history.append({"role": "assistant", "content": ai_response})

        db.session.commit()

        # 8. Generate suggestions
        suggestions = AIFormService._generate_suggestions(schema, mode)

        return {
            'session_id': str(session.id),
            'message': ai_response,
            'schema': schema,
            'suggestions': suggestions
        }

    @staticmethod
    def _generate_suggestions(schema, mode):
        """Generate next-step suggestions"""
        suggestions = []

        if mode == 'healthcare':
            # Check if vital signs are present
            field_labels = [f.get('label', '').lower() for page in schema.get('pages', [])
                           for f in page.get('fields', [])]

            if not any('blood pressure' in label for label in field_labels):
                suggestions.append("Add vital signs section (BP, HR, Temp, SpO2)")

            if not any('risk' in label for label in field_labels):
                suggestions.append("Add risk score calculation")

        return suggestions
```

---

### **PHASE 3: Advanced Features (Week 5-6)**

#### 3.1 Conversational Editing

**Examples of natural language commands:**

```
User: "Make all fields on page 2 required"
→ AI updates all fields on page 2 with required: true

User: "Add a BMI calculator that uses height and weight"
→ AI adds:
  1. Height field (numeric, cm)
  2. Weight field (numeric, kg)
  3. BMI field (numeric, calculated, read-only)
  4. Adds calculation rule

User: "Change the pain scale to show 5 emoji faces instead of numbers"
→ AI updates painScale config: {scaleSize: 5, showEmojis: true}

User: "Hide the smoking history field if patient age < 18"
→ AI adds visibilityRules to smoking field

User: "Generate risk rules for sepsis screening based on qSOFA"
→ AI creates risk rules for:
  - Respiratory rate >= 22
  - Altered mentation
  - Systolic BP <= 100
```

#### 3.2 Healthcare-Specific Intelligence

**Auto-detection and suggestions:**

```python
class HealthcareIntelligence:

    @staticmethod
    def suggest_clinical_scales(form_purpose):
        """Suggest appropriate clinical scales"""
        mappings = {
            'sepsis': ['qSOFA', 'SIRS', 'SOFA'],
            'stroke': ['NIHSS', 'mRS'],
            'pain': ['NRS', 'VAS', 'Wong-Baker FACES'],
            'cardiac': ['CHADS2-VASc', 'HAS-BLED', 'GRACE'],
            'cancer': ['ECOG', 'Karnofsky'],
            'mental health': ['PHQ-9', 'GAD-7', 'MMSE']
        }
        # Return relevant scales

    @staticmethod
    def suggest_loinc_codes(field_label):
        """Map field to LOINC code"""
        loinc_map = {
            'blood pressure systolic': '8480-6',
            'blood pressure diastolic': '8462-4',
            'heart rate': '8867-4',
            'respiratory rate': '9279-1',
            'temperature': '8310-5',
            'oxygen saturation': '2708-6'
        }
        # Return matching LOINC code

    @staticmethod
    def validate_clinical_workflow(schema):
        """Ensure clinical best practices"""
        issues = []

        # Check for patient identifier
        has_patient_id = any(
            'patient' in field.get('label', '').lower()
            for field in get_all_fields(schema)
        )
        if not has_patient_id:
            issues.append("Missing patient identifier (ABHA ID/MRN)")

        # Check for consent
        has_consent = any(
            field.get('type') == 'checkbox' and
            'consent' in field.get('label', '').lower()
            for field in get_all_fields(schema)
        )
        if not has_consent:
            issues.append("Consider adding consent checkbox")

        return issues
```

---

## 🎨 User Experience Flow

### Scenario 1: General Form (Event Registration)

```
1. User clicks "🤖 Create with AI (General)"

2. LLM Setup Screen:
   Provider: [OpenAI ▼]
   Model: [GPT-4 Turbo ▼]
   API Key: [sk-proj-********************************]
   [Validate & Continue]

3. Chat Interface:
   User: "Create a conference registration form"

   AI: "I'll create a conference registration form for you.
        I've included:
        - Personal Information (name, email, phone)
        - Organization Details
        - Ticket Selection
        - Dietary Preferences
        - Special Requirements

        [Preview shows generated form]

        Would you like me to add anything else?"

   User: "Add a field for T-shirt size and make it required"

   AI: "Added! I've included T-shirt size as a required select
        field with options: XS, S, M, L, XL, XXL"

   User: "Perfect! Create the form"

   [Form created successfully ✓]
```

### Scenario 2: Healthcare Form (Sepsis Screening)

```
1. User clicks "🏥 Create with AI (Healthcare)"

2. LLM Setup Screen:
   [Same as above]

3. Chat Interface:
   User: "Create a sepsis screening form for emergency department"

   AI: "I'll create an ABDM-compliant sepsis screening form
        using qSOFA criteria. I've included:

        📋 Patient Information
        - ABHA ID (required)
        - Demographics (age, gender)

        🏥 Clinical Assessment
        - Chief Complaint
        - Vital Signs (HR, BP, RR, Temp, SpO2) with LOINC codes
        - Mental Status (GCS or AVPU)
        - Skin Assessment (mottling, capillary refill)

        ⚠️ Risk Scoring
        - Auto-calculated qSOFA score
        - Color-coded risk level (Low/Medium/High)

        📊 Risk Rules Generated:
        - RR >= 22 → +1 point
        - SBP <= 100 → +1 point
        - Altered mental status → +1 point
        - qSOFA >= 2 → High Risk (red alert)

        [Preview shows form with real-time risk calculation]"

   User: "Add a section for lactate level"

   AI: "Added! Lactate field with:
        - LOINC code: 2524-7
        - Unit: mmol/L
        - Normal range: 0.5-2.0
        - Risk rule: Lactate >2 → additional risk factor"

   User: "Generate the form and risk rules"

   [Form created with risk assessment system ✓]
```

---

## 🏆 Competitive Advantages

### Why This Stands Out:

1. **Conversational Refinement**
   - Competitors: Generate once, manual edit after
   - You: Continuous conversation, iterative improvement

2. **Healthcare Intelligence**
   - Competitors: Generic forms only
   - You: ABDM/FHIR aware, LOINC mapping, risk rules, clinical scales

3. **Bring Your Own LLM**
   - Competitors: Locked to their AI (privacy concerns)
   - You: User chooses provider, keeps API key private

4. **Context-Aware**
   - Competitors: AI doesn't know your field types
   - You: AI knows about painScale, severityRating, functionalStatus

5. **Risk Rule Generation**
   - Competitors: No clinical decision support
   - You: Auto-generates clinical risk rules (qSOFA, NEWS, etc.)

6. **Dual Mode**
   - Competitors: One-size-fits-all
   - You: General mode + Healthcare mode with different system prompts

7. **Section-Level Editing**
   - Competitors: Whole form regeneration
   - You: "Add this section", "Edit this field" granular control

---

## 🔧 New APIs Summary

### Backend APIs to Create:

```
POST /api/ai-forms/generate          # Initial generation
POST /api/ai-forms/refine            # Iterative updates
POST /api/ai-forms/add-section       # Add new section
POST /api/ai-forms/edit-field        # Modify specific field
POST /api/ai-forms/validate          # Validate with AI
POST /api/ai-forms/suggest-risk-rules # Generate risk rules
POST /api/ai-forms/finalize          # Save to database
GET  /api/ai-forms/sessions/:id      # Retrieve session
DELETE /api/ai-forms/sessions/:id    # Abandon session
```

### Frontend Components to Create:

```
src/components/ai/
├── AIFormBuilderModal.jsx           # Main container
├── LLMSelector.jsx                  # Provider selection
├── AIChat.jsx                       # Chat interface
├── FormPreview.jsx                  # Live preview
├── ConversationHistory.jsx          # History sidebar
└── AILoadingIndicator.jsx           # Loading states

src/api/ai-forms.js                  # API client
src/hooks/useAIFormBuilder.js        # State management
```

### Frontend Changes Needed:

**`frontend/src/pages/forms/FormsList.jsx`**
- Add two new buttons: "🤖 AI General" and "🏥 AI Healthcare"
- Open AIFormBuilderModal with mode prop

**`frontend/src/pages/forms/FormBuilder.jsx`**
- Add "✨ Refine with AI" button in existing forms
- Allow AI editing of existing forms

---

## 📊 Implementation Phases

### Week 1-2: Foundation
- [ ] Backend AI module structure
- [ ] Database migrations (AIFormSession, AIGenerationLog)
- [ ] LLM provider abstraction
- [ ] System prompts (general + healthcare)
- [ ] Basic schema generation
- [ ] Frontend modal component skeleton

### Week 3-4: Core Features
- [ ] All AI API endpoints
- [ ] Schema validator
- [ ] Conversation history management
- [ ] Frontend chat interface
- [ ] Live form preview
- [ ] LLM selector component
- [ ] Integration with existing FormBuilder

### Week 5-6: Advanced Features
- [ ] Section-level editing
- [ ] Field-level refinement
- [ ] Risk rule generation
- [ ] Healthcare intelligence (LOINC, scales)
- [ ] Suggestions engine
- [ ] Error handling & retries
- [ ] Rate limiting & cost tracking

### Week 7-8: Polish & Testing
- [ ] UI/UX refinement
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Example prompts library
- [ ] Cost estimation tool
- [ ] Analytics dashboard (token usage, success rates)

---

## 💰 Cost Considerations

**Token Usage Estimates:**
- Initial generation: 3,000-5,000 tokens
- Refinement: 1,000-2,000 tokens each
- Average form: 3-5 iterations = ~15,000 tokens total

**Pricing (approximate):**
- GPT-4 Turbo: $0.15 per form
- Claude 3.5 Sonnet: $0.12 per form
- Gemini Pro: $0.08 per form

**Recommendation:**
- Offer 5 free AI generations per user/month
- Charge $0.25 per AI generation after (still profitable)
- Or include unlimited in premium plan

---

## 🚀 Go-to-Market Strategy

**Positioning:**
"The only AI form builder that speaks healthcare"

**Target Audience:**
- Primary: Indian hospitals/clinics needing ABDM compliance
- Secondary: Event organizers, researchers, HR departments

**Messaging:**
- "Generate ABDM-compliant forms in minutes, not hours"
- "AI that understands qSOFA, LOINC, and clinical workflows"
- "Your AI, your rules - bring your own OpenAI/Claude API key"

**Demo Videos:**
1. "Build a sepsis screening form in 60 seconds"
2. "From idea to production form through conversation"
3. "AI generates clinical risk rules automatically"

---

## 📝 Technical Specifications

### Database Schema Changes

```sql
-- Migration: Add AI form builder tables

CREATE TABLE ai_form_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    llm_provider VARCHAR(50) NOT NULL,
    llm_model VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    conversation_history JSONB NOT NULL DEFAULT '[]',
    current_schema JSONB,
    form_id UUID REFERENCES forms(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE ai_generation_logs (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES ai_form_sessions(id) ON DELETE CASCADE,
    prompt_sent TEXT NOT NULL,
    response_received TEXT,
    tokens_used INTEGER,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_user ON ai_form_sessions(user_id);
CREATE INDEX idx_ai_sessions_status ON ai_form_sessions(status);
CREATE INDEX idx_ai_logs_session ON ai_generation_logs(session_id);
```

### Required Python Packages

```txt
# Add to backend/requirements.txt

openai==1.12.0              # OpenAI API
anthropic==0.18.1           # Claude API
google-generativeai==0.3.2  # Gemini API
tiktoken==0.6.0             # Token counting
```

### Environment Variables

```bash
# Add to backend/.env

# AI Form Builder (optional - users bring their own keys)
# These are fallback keys for demo purposes
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Rate limiting
AI_GENERATION_RATE_LIMIT=10  # requests per hour per user
AI_TOKEN_BUDGET_PER_USER=50000  # monthly token limit per user
```

---

Ready to revolutionize healthcare forms? 🚀
