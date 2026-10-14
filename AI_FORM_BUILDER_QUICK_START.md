# 🚀 AI Form Builder - Quick Start Guide

## ⚡ Getting Started in 5 Minutes

### Step 1: Install Dependencies

```bash
cd backend
pip install openai anthropic google-generativeai tiktoken
```

### Step 2: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python run.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Step 3: Get an API Key

Choose one provider and get your API key:

**Option A: OpenAI (Recommended)**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-...`)

**Option B: Anthropic Claude**
1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy the key (starts with `sk-ant-...`)

**Option C: Google Gemini**
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

### Step 4: Create Your First AI Form

1. Navigate to **http://localhost:3000/forms**
2. Click **🏥 AI Healthcare** (or 🤖 AI General)
3. Select your provider (OpenAI, Anthropic, or Gemini)
4. Paste your API key
5. Click **"Start Building with AI"**

### Step 5: Chat with AI

Try these prompts:

**For Healthcare Mode:**
```
Create a patient intake form with vitals and medical history
```

**For General Mode:**
```
Create a conference registration form
```

**Refinement:**
```
Add a BMI calculator field

Make email required

Add a risk score display
```

---

## 🎬 Example Conversation

### Healthcare Sepsis Screening

**You:** `Create a sepsis screening form with qSOFA criteria`

**AI:** ✨ Creates form with:
- Patient demographics (ABHA ID, age, gender)
- Vital signs (BP, HR, RR, Temp, SpO2) with LOINC codes
- Mental status assessment
- Risk score display with qSOFA rules
- 4 pages, 18 fields

**You:** `Add a lactate level field`

**AI:** ✨ Adds lactate field with:
- LOINC code 2524-7
- Unit: mmol/L
- Risk rule: >2.0 = High risk

**You:** `Perfect!` → Click **Create Form** ✅

---

## 💡 Pro Tips

### Get Better Results

1. **Be Specific**: "Create a pain assessment form with 0-10 scale" vs "Create a pain form"

2. **Mention Pages**: "Create a 3-page form with demographics, vitals, and assessment"

3. **Specify Field Types**: "Add a dropdown for country selection" vs "Add country"

4. **Use Healthcare Keywords**: "Add vital signs with LOINC codes" → AI knows to use clinical mapping

5. **Ask for Features**: "Include risk scoring", "Add calculated BMI field", "Make it ABDM compliant"

### Cost Optimization

- **Use GPT-3.5 Turbo** for simple forms → $0.01 per form
- **Use Haiku** for quick iterations → $0.003 per form
- **Use GPT-4/Claude 3.5** for complex healthcare forms → $0.15-$0.20 per form

### Iterative Building

Start simple, then refine:
```
1. "Create a patient intake form"
2. "Add vital signs section"
3. "Include risk assessment"
4. "Add LOINC codes to all vitals"
```

---

## 🏥 Healthcare Mode Features

When you use **🏥 AI Healthcare**, you get:

✅ **Automatic LOINC Codes** for vitals
✅ **Risk Rule Suggestions** (qSOFA, NEWS2, Morse)
✅ **Clinical Scales** (ECOG, Karnofsky, painScale)
✅ **ABDM Compliance** (ABHA ID, consent, audit)
✅ **Field Section Awareness** (AI knows about your 7 physiotherapy sections)

---

## 📝 General Mode Features

When you use **🤖 AI General**, you get:

✅ **Simple Forms** without healthcare complexity
✅ **Event Registration** forms
✅ **Surveys & Feedback** forms
✅ **Contact Forms**
✅ **All 21 field types** available

---

## 🎯 What You Can Ask AI

### Form Creation
- "Create a [type] form"
- "Build a [purpose] form with [features]"
- "Generate a [X]-page form"

### Add Features
- "Add a section for [topic]"
- "Include [field type] field for [purpose]"
- "Add risk scoring for [condition]"
- "Include LOINC codes"

### Modify Fields
- "Make [field] required"
- "Change [field] to dropdown"
- "Add validation to [field]"
- "Remove [field]"

### Organize
- "Split into multiple pages"
- "Group related fields together"
- "Add sections to organize the form"

### Advanced
- "Add BMI calculator"
- "Include conditional logic: show X if Y"
- "Add risk rules for sepsis"
- "Make it ABDM compliant"

---

## ⚠️ Troubleshooting

### "Invalid API key"
- Double-check you copied the full key
- Make sure key has sufficient credits
- Try generating a new key

### "AI did not generate valid schema"
- Rephrase your request
- Break complex requests into steps
- Start with simple form, then refine

### Form preview not showing
- Wait for "✓ Generated successfully" message
- Check browser console for errors
- Try refreshing the page

### Migration not applied
```bash
cd backend
python -m flask db upgrade
```

---

## 🎓 Learning Path

### Beginner (Day 1)
1. Create simple general form
2. Try basic refinements
3. Explore different field types

### Intermediate (Day 2-3)
1. Create healthcare form with vitals
2. Add clinical mappings
3. Try multi-page forms

### Advanced (Day 4-5)
1. Generate risk scoring rules
2. Add calculated fields
3. Create ABDM-compliant forms

---

## 📊 Example Forms to Try

### General Forms
```
1. Event Registration
   "Create a conference registration form with attendee info, ticket selection, and dietary preferences"

2. Job Application
   "Build a job application form with personal details, education, experience, and resume upload"

3. Customer Feedback
   "Create a customer satisfaction survey with rating scales and comment fields"
```

### Healthcare Forms
```
1. Patient Intake
   "Create a patient intake form with ABHA ID, demographics, chief complaint, vitals, and medical history"

2. Sepsis Screening
   "Build a sepsis screening form with qSOFA criteria and risk scoring"

3. Fall Risk Assessment
   "Generate a fall risk assessment using Morse Fall Scale criteria"

4. Pain Assessment
   "Create a comprehensive pain assessment with location, intensity, character, and duration"
```

---

## 🔥 Power User Tips

### Batch Requests
```
"Create a form with:
- Page 1: Patient demographics and ABHA ID
- Page 2: Vital signs with LOINC codes
- Page 3: Pain assessment with 0-10 scale
- Page 4: Risk score display

Include qSOFA risk rules and make all vitals required"
```

### Use Examples
```
"Create a pain assessment form like this:
- Pain location (dropdown: head, chest, abdomen, back, limbs)
- Pain intensity (0-10 pain scale)
- Pain character (select: sharp, dull, burning, aching)
- Duration (number in hours)
- Aggravating factors (text)
- Relieving factors (text)"
```

### Reference Existing
```
"Create a form similar to patient intake but for physiotherapy assessment with these additions:
- Range of motion measurements
- Muscle strength testing
- Gait analysis
- Functional status scale"
```

---

## 🎉 You're Ready!

Everything you need is set up. Just:

1. **Get an API key** (5 minutes)
2. **Start the app** (30 seconds)
3. **Click AI Healthcare** (1 click)
4. **Start chatting** (unlimited possibilities!)

**Cost**: ~$0.10-$0.20 per form
**Time saved**: 85% faster than manual creation

---

## 💬 Need Help?

Check the full documentation:
- **Implementation Guide**: `AI_FORM_BUILDER_IMPLEMENTATION_COMPLETE.md`
- **Architecture Plan**: `docs/AI_FORM_BUILDER_V2_PLAN.md`

Or just ask the AI! It's trained to help you build forms conversationally.

**Happy Building!** 🚀
