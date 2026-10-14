# AI Form Editor - Implementation Plan

## 🎯 Goal
Allow users to edit existing forms using natural language AI, similar to the form builder but with context of the existing form structure.

---

## 🤔 Key Questions to Discuss

### 1. **Entry Points - Where can users access AI editing?**

**Option A: Form Builder Integration**
- Add "AI Edit Mode" button in the form builder toolbar
- Opens AI chat panel alongside the builder
- AI can make changes that update the builder in real-time

**Option B: Forms List Integration**
- Add "✨ Edit with AI" button on each form card
- Opens AI modal with form loaded
- Similar to current AI builder modal but pre-loaded with form

**Option C: Both**
- Form builder has AI assistant panel
- Forms list has quick edit option
- Most flexible but more development

**Your preference?** 🤔

---

### 2. **Edit Capabilities - What should AI be able to do?**

**Basic Operations:**
- ✅ Add new fields to existing pages
- ✅ Remove fields (with safety checks)
- ✅ Modify field properties (label, validation, type)
- ✅ Reorder fields within pages
- ✅ Change field requirements (make required/optional)

**Advanced Operations:**
- ✅ Add/remove pages
- ✅ Move fields between pages
- ✅ Add clinical mappings (LOINC codes)
- ✅ Add risk rules
- ✅ Add conditional logic
- ✅ Convert field types (with data migration warnings)

**Safety Constraints:**
- ⚠️ Warn if form has submissions
- ⚠️ Prevent breaking changes (field ID changes, type changes that lose data)
- ⚠️ Show impact analysis ("This change affects 47 submissions")
- ⚠️ Option to create new version vs modify in place

**Should we implement all or start with basics?** 🤔

---

### 3. **User Experience - How should the edit flow work?**

**Flow Option A: Conversational In-Place**
```
1. User clicks "Edit with AI"
2. Modal opens with current form loaded
3. AI shows current state: "I see your Patient Intake Form with 15 fields across 3 pages"
4. User: "Add a field for emergency contact phone number"
5. AI: "I'll add an emergency contact phone field to the Demographics page"
6. Preview shows before/after comparison
7. User: "Perfect!" → Changes applied
```

**Flow Option B: Diff-Based Review**
```
1. User describes changes in conversation
2. AI generates complete updated schema
3. System shows visual diff (red for removed, green for added, yellow for modified)
4. User reviews and approves/rejects
5. Apply changes or continue refining
```

**Flow Option C: Hybrid**
```
1. Conversational refinement with live preview
2. Before final save, show comprehensive diff
3. User can go back to refine or apply
```

**Which flow feels better?** 🤔

---

### 4. **System Prompt Design - How should AI understand edits?**

**Approach A: Edit-Specific Prompt**
```python
FORM_EDIT_SYSTEM_PROMPT = f"""
You are a form editor AI. You have been given an existing form schema and must make
ONLY the requested changes while preserving everything else.

CURRENT FORM:
{{current_form_schema}}

RULES:
1. Preserve existing field IDs unless explicitly asked to change
2. Maintain page structure unless asked to reorganize
3. Keep clinical mappings unless updating
4. For field additions, suggest appropriate placement
5. For field removals, warn about potential data loss
6. For type changes, explain migration implications

RESPONSE FORMAT:
{{"explanation": "I'll add...", "changes": [...], "warnings": [...], "updated_schema": {{...}}}}
"""
```

**Approach B: Unified Prompt with Mode**
```python
# Extend existing prompt with edit mode context
if mode == 'edit':
    prompt += f"""
    EDIT MODE: You are modifying an existing form.
    Current schema: {{current_schema}}
    Only change what the user requests. Preserve field IDs and structure.
    """
```

**Approach C: Diff-Based Prompt**
```python
FORM_DIFF_SYSTEM_PROMPT = """
You are a form diff generator. Given a form and requested changes,
output only the differences as add/remove/modify operations.

OUTPUT:
{{"operations": [
  {{"type": "add", "path": "pages[0].fields", "field": {{...}}}},
  {{"type": "modify", "path": "pages[1].fields[2].label", "from": "...", "to": "..."}},
  {{"type": "remove", "path": "pages[0].fields[3]", "warning": "..."}}
]}}
"""
```

**Which approach is most reliable?** 🤔

---

## 🏗️ Technical Implementation Options

### Architecture Option 1: Separate Edit Endpoints
```python
# New dedicated edit endpoints
POST /api/ai-forms/edit/start        # Load form into AI session
POST /api/ai-forms/edit/modify       # Request modifications
POST /api/ai-forms/edit/apply        # Apply changes to form
POST /api/ai-forms/edit/diff         # Get diff preview
```

**Pros:**
- Clear separation of concerns
- Easier to add edit-specific logic
- Can track edit sessions separately

**Cons:**
- More code duplication
- More endpoints to maintain

---

### Architecture Option 2: Mode Parameter on Existing Endpoints
```python
# Extend existing endpoints
POST /api/ai-forms/generate  # Add mode='edit', form_id=...
# Response includes diff when in edit mode
```

**Pros:**
- Reuse existing infrastructure
- Less code duplication
- Simpler API

**Cons:**
- Endpoint does double duty
- More complex internal logic

---

### Architecture Option 3: Hybrid - Edit Service Layer
```python
# New service class, reuse endpoints with internal routing
class AIFormEditService:
    def load_form_for_editing(form_id) -> AISession
    def apply_edits(session_id, operations) -> UpdatedForm
    def generate_diff(current, updated) -> Diff
    def validate_breaking_changes(form, operations) -> Warnings
```

**Pros:**
- Clean service layer
- Reuse API endpoints
- Good separation of business logic

**Cons:**
- More abstraction layers

---

## 📋 Proposed Implementation Phases

### Phase 1: Basic Edit Mode (MVP)
**Scope:**
- Edit button on forms list
- Load form into AI session
- AI can add/remove/modify fields
- Simple text-based diff preview
- Apply changes (no submissions check yet)

**Technical:**
- Extend existing AI endpoints with edit mode
- New system prompt for edit mode
- Load form schema into conversation
- Schema merge/patch logic

**Estimated effort:** Medium

---

### Phase 2: Safety & Validation
**Scope:**
- Check if form has submissions
- Breaking change detection
- Visual diff preview (before/after)
- Warnings for data loss
- Option to create new version

**Technical:**
- Submission count check
- Field compatibility validation
- React diff view component
- Form versioning logic

**Estimated effort:** Medium-High

---

### Phase 3: Advanced Editing
**Scope:**
- Form builder AI panel (side-by-side)
- Real-time preview updates
- Multi-step edit sessions
- Undo/redo support
- Batch operations

**Technical:**
- WebSocket for real-time updates
- State management for edit history
- Complex UI integration

**Estimated effort:** High

---

## 💡 Recommendations

Based on typical use cases, I recommend:

### Start with: **Phase 1 MVP**

**Entry Point:** Forms list "Edit with AI" button (Option B)
- Simpler to implement
- Clear user intent
- Isolated from form builder complexity

**Capabilities:** Basic add/remove/modify (Safe subset)
- Add fields
- Modify labels, validation, requirements
- Remove fields (with warning)
- Add clinical mappings

**UX Flow:** Hybrid (Option C)
- Conversational with live preview
- Final diff review before apply

**System Prompt:** Edit-Specific (Approach A)
- Most explicit about preserving existing structure
- Clearer AI behavior
- Better error handling

**Architecture:** Hybrid (Option 3)
- Clean service layer
- Extend existing endpoints
- Easy to evolve

---

## 🎨 UI Mockup Concept

```
┌─────────────────────────────────────────────────────────┐
│ AI Form Editor - Patient Intake Form              [X]  │
├────────────────────┬────────────────────────────────────┤
│  Conversation      │  Before / After Preview            │
│                    │                                    │
│  AI: I see your    │  ┌─────────────┬─────────────┐    │
│  Patient Intake    │  │   Before    │    After    │    │
│  Form with 15      │  ├─────────────┼─────────────┤    │
│  fields across     │  │ Page 1      │ Page 1      │    │
│  3 pages. What     │  │ - Name      │ - Name      │    │
│  would you like    │  │ - Age       │ - Age       │    │
│  to change?        │  │ - Gender    │ - Gender    │    │
│                    │  │             │ + Emergency │ ✨  │
│  You: Add an       │  │             │   Contact   │    │
│  emergency contact │  └─────────────┴─────────────┘    │
│  phone field       │                                    │
│                    │  [🔙 Back]  [✅ Apply Changes]    │
│  [Type message...] │                                    │
└────────────────────┴────────────────────────────────────┘
```

---

## 🚀 Next Steps

**For Discussion:**

1. **Entry point preference?** (Forms list, Builder, or Both)
2. **Start with basic or include advanced edits?**
3. **UX flow preference?** (In-place, Diff-based, or Hybrid)
4. **Should we warn about submissions or block edits?**
5. **Version creation vs in-place edit preference?**

**Once decided, I can:**
- Create the edit-specific system prompt
- Implement the edit service layer
- Add UI components for diff preview
- Wire up the edit flow

---

## 📊 Comparison Table

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Entry Point** | Form Builder | Forms List | Both |
| Complexity | High | Medium | Very High |
| User Flow | Integrated | Isolated | Flexible |
| Development Time | Long | Medium | Very Long |
| **Recommended** | Phase 3 | ✅ Phase 1 | Future |

| Edit Capability | Basic | Advanced | Enterprise |
|----------------|-------|----------|------------|
| Add/Remove Fields | ✅ | ✅ | ✅ |
| Modify Properties | ✅ | ✅ | ✅ |
| Clinical Mapping | ❌ | ✅ | ✅ |
| Breaking Change Guard | ❌ | ✅ | ✅ |
| Versioning | ❌ | ❌ | ✅ |
| Real-time Preview | ❌ | ✅ | ✅ |
| **Recommended** | - | ✅ MVP | Future |

---

## 🎯 My Recommendation for MVP

**Let's build:**
1. **Entry:** "✨ Edit with AI" button on forms list
2. **Flow:** Modal with conversation (left) + before/after preview (right)
3. **Capabilities:** Add/modify/remove fields, with warnings
4. **Safety:** Show submission count, warn on breaking changes
5. **System Prompt:** Edit-specific prompt that preserves structure
6. **Architecture:** Edit service layer, extend existing endpoints

**Timeline:** Can implement in current session if you approve!

---

What do you think? Which options do you prefer? 🤔
