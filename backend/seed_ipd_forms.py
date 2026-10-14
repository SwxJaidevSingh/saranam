"""
Seed script to create default IPD form templates.
Run with: python seed_ipd_forms.py
"""
import sys
from app import create_app
from app.extensions import db
from app.forms.models import Form

def create_admission_form():
    """Create default IPD admission form template."""
    schema = {
        "pages": [
            {
                "id": "admission_details",
                "title": "Admission Details",
                "fields": [
                    {
                        "id": "admission_reason",
                        "type": "textarea",
                        "label": "Reason for Admission",
                        "required": True,
                        "placeholder": "Describe the primary reason for hospital admission"
                    },
                    {
                        "id": "presenting_complaints",
                        "type": "textarea",
                        "label": "Presenting Complaints",
                        "required": True,
                        "placeholder": "List all presenting complaints"
                    },
                    {
                        "id": "allergies",
                        "type": "textarea",
                        "label": "Known Allergies",
                        "required": False,
                        "placeholder": "List any known drug or food allergies"
                    },
                    {
                        "id": "current_medications",
                        "type": "textarea",
                        "label": "Current Medications",
                        "required": False,
                        "placeholder": "List all current medications with dosage"
                    }
                ]
            },
            {
                "id": "medical_history",
                "title": "Medical History",
                "fields": [
                    {
                        "id": "past_medical_history",
                        "type": "textarea",
                        "label": "Past Medical History",
                        "required": False,
                        "placeholder": "Previous illnesses, surgeries, hospitalizations"
                    },
                    {
                        "id": "family_history",
                        "type": "textarea",
                        "label": "Family Medical History",
                        "required": False,
                        "placeholder": "Relevant family medical history"
                    },
                    {
                        "id": "social_history",
                        "type": "textarea",
                        "label": "Social History",
                        "required": False,
                        "placeholder": "Smoking, alcohol, occupation, living situation"
                    }
                ]
            },
            {
                "id": "advance_directives",
                "title": "Advance Directives & Emergency Contact",
                "fields": [
                    {
                        "id": "advance_directives",
                        "type": "select",
                        "label": "Advance Directives",
                        "required": False,
                        "options": ["None", "DNR", "DNI", "Living Will", "Healthcare Proxy"]
                    },
                    {
                        "id": "emergency_contact_name",
                        "type": "text",
                        "label": "Emergency Contact Name",
                        "required": True
                    },
                    {
                        "id": "emergency_contact_relation",
                        "type": "text",
                        "label": "Relationship",
                        "required": True
                    },
                    {
                        "id": "emergency_contact_phone",
                        "type": "phone",
                        "label": "Emergency Contact Phone",
                        "required": True
                    }
                ]
            }
        ]
    }

    form = Form(
        name="IPD Admission Form (Default)",
        description="Standard admission form for in-patient department",
        schema=schema,
        is_template=True,
        template_category="ipd",
        template_description="Comprehensive admission form capturing patient history, allergies, medications, and emergency contacts"
    )

    return form


def create_discharge_form():
    """Create default IPD discharge form template."""
    schema = {
        "pages": [
            {
                "id": "discharge_summary",
                "title": "Discharge Summary",
                "fields": [
                    {
                        "id": "final_diagnosis",
                        "type": "textarea",
                        "label": "Final Diagnosis",
                        "required": True,
                        "placeholder": "Primary and secondary diagnoses"
                    },
                    {
                        "id": "hospital_course",
                        "type": "textarea",
                        "label": "Hospital Course",
                        "required": True,
                        "placeholder": "Summary of treatment and progress during hospitalization"
                    },
                    {
                        "id": "procedures_performed",
                        "type": "textarea",
                        "label": "Procedures Performed",
                        "required": False,
                        "placeholder": "List all procedures, surgeries, or interventions"
                    },
                    {
                        "id": "condition_at_discharge",
                        "type": "select",
                        "label": "Condition at Discharge",
                        "required": True,
                        "options": ["Improved", "Stable", "Unchanged", "Worsened"]
                    }
                ]
            },
            {
                "id": "discharge_medications",
                "title": "Discharge Medications",
                "fields": [
                    {
                        "id": "discharge_medications_list",
                        "type": "textarea",
                        "label": "Discharge Medications",
                        "required": True,
                        "placeholder": "List all medications with dosage, frequency, and duration"
                    },
                    {
                        "id": "medication_changes",
                        "type": "textarea",
                        "label": "Medication Changes",
                        "required": False,
                        "placeholder": "New medications, discontinued medications, dosage changes"
                    }
                ]
            },
            {
                "id": "discharge_instructions",
                "title": "Discharge Instructions",
                "fields": [
                    {
                        "id": "diet_instructions",
                        "type": "textarea",
                        "label": "Dietary Instructions",
                        "required": False,
                        "placeholder": "Special diet requirements or restrictions"
                    },
                    {
                        "id": "activity_restrictions",
                        "type": "textarea",
                        "label": "Activity Restrictions",
                        "required": False,
                        "placeholder": "Activity limitations, rest requirements, restrictions"
                    },
                    {
                        "id": "wound_care_instructions",
                        "type": "textarea",
                        "label": "Wound Care Instructions",
                        "required": False,
                        "placeholder": "Instructions for wound care, dressing changes"
                    },
                    {
                        "id": "warning_signs",
                        "type": "textarea",
                        "label": "Warning Signs to Watch For",
                        "required": True,
                        "placeholder": "Symptoms requiring immediate medical attention"
                    },
                    {
                        "id": "follow_up_instructions",
                        "type": "textarea",
                        "label": "Follow-up Instructions",
                        "required": True,
                        "placeholder": "When and where to follow up, tests needed"
                    }
                ]
            }
        ]
    }

    form = Form(
        name="IPD Discharge Form (Default)",
        description="Standard discharge summary and instructions form",
        schema=schema,
        is_template=True,
        template_category="ipd",
        template_description="Comprehensive discharge documentation including diagnosis, medications, and follow-up instructions"
    )

    return form


def create_progress_note_form():
    """Create default progress note form template."""
    schema = {
        "fields": [
            {
                "id": "subjective",
                "type": "textarea",
                "label": "Subjective (S)",
                "required": True,
                "placeholder": "Patient's complaints, symptoms, concerns"
            },
            {
                "id": "objective",
                "type": "textarea",
                "label": "Objective (O)",
                "required": True,
                "placeholder": "Vital signs, physical examination findings, test results"
            },
            {
                "id": "assessment",
                "type": "textarea",
                "label": "Assessment (A)",
                "required": True,
                "placeholder": "Clinical impression, diagnosis, progress evaluation"
            },
            {
                "id": "plan",
                "type": "textarea",
                "label": "Plan (P)",
                "required": True,
                "placeholder": "Treatment plan, medications, investigations, follow-up"
            },
            {
                "id": "additional_notes",
                "type": "textarea",
                "label": "Additional Notes",
                "required": False,
                "placeholder": "Any additional observations or instructions"
            }
        ]
    }

    form = Form(
        name="Progress Note (SOAP Format)",
        description="Daily progress note using SOAP format",
        schema=schema,
        is_template=True,
        template_category="ipd",
        template_description="SOAP format progress note for daily clinical documentation"
    )

    return form


def create_nursing_assessment_form():
    """Create default nursing assessment form template."""
    schema = {
        "pages": [
            {
                "id": "vital_assessment",
                "title": "Vital Signs & General Assessment",
                "fields": [
                    {
                        "id": "level_of_consciousness",
                        "type": "select",
                        "label": "Level of Consciousness",
                        "required": True,
                        "options": ["Alert", "Drowsy", "Confused", "Lethargic", "Unresponsive"]
                    },
                    {
                        "id": "orientation",
                        "type": "checkbox",
                        "label": "Orientation",
                        "required": False,
                        "options": ["Person", "Place", "Time", "Situation"]
                    },
                    {
                        "id": "pain_score",
                        "type": "painScale",
                        "label": "Pain Score (0-10)",
                        "required": True,
                        "config": {
                            "min": 0,
                            "max": 10
                        }
                    },
                    {
                        "id": "pain_location",
                        "type": "text",
                        "label": "Pain Location (if applicable)",
                        "required": False
                    }
                ]
            },
            {
                "id": "skin_assessment",
                "title": "Skin & Mobility Assessment",
                "fields": [
                    {
                        "id": "skin_integrity",
                        "type": "select",
                        "label": "Skin Integrity",
                        "required": True,
                        "options": ["Intact", "Rash", "Bruising", "Wound", "Pressure Ulcer"]
                    },
                    {
                        "id": "fall_risk_score",
                        "type": "linearScale",
                        "label": "Fall Risk Assessment Score",
                        "required": True,
                        "config": {
                            "min": 0,
                            "max": 10,
                            "minLabel": "Low Risk",
                            "maxLabel": "High Risk"
                        }
                    },
                    {
                        "id": "mobility_status",
                        "type": "select",
                        "label": "Mobility Status",
                        "required": True,
                        "options": ["Independent", "Assistance Required", "Wheelchair", "Bed-bound"]
                    }
                ]
            },
            {
                "id": "nursing_interventions",
                "title": "Interventions & Plan",
                "fields": [
                    {
                        "id": "interventions_provided",
                        "type": "textarea",
                        "label": "Nursing Interventions Provided",
                        "required": True,
                        "placeholder": "List all nursing care activities performed"
                    },
                    {
                        "id": "patient_response",
                        "type": "textarea",
                        "label": "Patient Response",
                        "required": False,
                        "placeholder": "Patient's response to interventions"
                    },
                    {
                        "id": "care_plan_updates",
                        "type": "textarea",
                        "label": "Care Plan Updates",
                        "required": False,
                        "placeholder": "Any changes to the nursing care plan"
                    }
                ]
            }
        ]
    }

    form = Form(
        name="Nursing Assessment Form",
        description="Comprehensive nursing assessment and documentation",
        schema=schema,
        is_template=True,
        template_category="ipd",
        template_description="Detailed nursing assessment covering vitals, pain, skin integrity, fall risk, and care interventions"
    )

    return form


def main():
    """Main function to seed IPD forms."""
    app = create_app()

    with app.app_context():
        print("Creating IPD form templates...")

        forms = [
            ("Admission", create_admission_form()),
            ("Discharge", create_discharge_form()),
            ("Progress Note", create_progress_note_form()),
            ("Nursing Assessment", create_nursing_assessment_form())
        ]

        for form_type, form in forms:
            # Check if form already exists
            existing = Form.query.filter_by(
                name=form.name,
                is_template=True
            ).first()

            if existing:
                print(f"  ⚠ {form_type} form already exists, skipping...")
                continue

            # Validate schema
            is_valid, message = form.validate_schema()
            if not is_valid:
                print(f"  ✗ {form_type} form validation failed: {message}")
                continue

            # Save form
            try:
                db.session.add(form)
                db.session.commit()
                print(f"  ✓ Created {form_type} form template (ID: {form.id})")
            except Exception as e:
                db.session.rollback()
                print(f"  ✗ Failed to create {form_type} form: {str(e)}")

        print("\nIPD form templates created successfully!")
        print("\nTo configure these forms for a service:")
        print("1. Go to IPD Form Configuration in the admin panel")
        print("2. Select the service/department")
        print("3. Assign the appropriate form templates")


if __name__ == "__main__":
    main()
