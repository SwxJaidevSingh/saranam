#!/usr/bin/env python
"""
Seed script to create form templates for each service type
"""

from app import create_app
from app.extensions import db
from app.forms.models import Form
from app.services.models import Service, ServiceForm, FormType
from app.services.services import ServiceService
import json
import uuid
import sys


def create_ipd_admission_form():
    """Create IPD admission form template"""
    form_schema = {
        "fields": [
            {
                "id": "admission_date",
                "type": "date",
                "label": "Admission Date",
                "required": True
            },
            {
                "id": "admission_time",
                "type": "time",
                "label": "Admission Time",
                "required": True
            },
            {
                "id": "admission_type",
                "type": "select",
                "label": "Admission Type",
                "required": True,
                "options": ["Emergency", "Planned", "Transfer", "Referral"]
            },
            {
                "id": "referring_doctor",
                "type": "text",
                "label": "Referring Doctor (if any)",
                "required": False
            },
            {
                "id": "chief_complaint",
                "type": "textarea",
                "label": "Chief Complaint",
                "required": True,
                "placeholder": "Primary reason for admission"
            },
            {
                "id": "present_illness",
                "type": "textarea",
                "label": "History of Present Illness",
                "required": True
            },
            {
                "id": "past_medical_history",
                "type": "textarea",
                "label": "Past Medical History",
                "required": True
            },
            {
                "id": "allergies",
                "type": "textarea",
                "label": "Known Allergies",
                "required": True,
                "placeholder": "List all known allergies (drugs, food, etc.)"
            },
            {
                "id": "current_medications",
                "type": "textarea",
                "label": "Current Medications",
                "required": False,
                "placeholder": "List all current medications with dosage"
            },
            {
                "id": "vital_signs_section",
                "type": "section",
                "label": "Vital Signs at Admission"
            },
            {
                "id": "blood_pressure",
                "type": "text",
                "label": "Blood Pressure (mmHg)",
                "required": True,
                "pattern": "\\d{2,3}/\\d{2,3}"
            },
            {
                "id": "pulse_rate",
                "type": "number",
                "label": "Pulse Rate (bpm)",
                "required": True,
                "min": 40,
                "max": 200
            },
            {
                "id": "temperature",
                "type": "number",
                "label": "Temperature (°F)",
                "required": True,
                "min": 95,
                "max": 106
            },
            {
                "id": "respiratory_rate",
                "type": "number",
                "label": "Respiratory Rate (per min)",
                "required": True,
                "min": 8,
                "max": 40
            },
            {
                "id": "oxygen_saturation",
                "type": "number",
                "label": "Oxygen Saturation (%)",
                "required": True,
                "min": 70,
                "max": 100
            },
            {
                "id": "emergency_contact_name",
                "type": "text",
                "label": "Emergency Contact Name",
                "required": True
            },
            {
                "id": "emergency_contact_phone",
                "type": "phone",
                "label": "Emergency Contact Phone",
                "required": True
            },
            {
                "id": "emergency_contact_relation",
                "type": "text",
                "label": "Relationship to Patient",
                "required": True
            },
            {
                "id": "consent_admission",
                "type": "checkbox",
                "label": "I consent to hospital admission and necessary treatment",
                "required": True
            }
        ]
    }

    return Form(
        name="IPD Admission Form",
        description="Comprehensive admission form for in-patient department",
        schema=json.dumps(form_schema),
        is_template=True,
        template_category="ipd",
        version=1,
        is_active=True,
        is_public=False
    )


def create_opd_consultation_form():
    """Create OPD consultation form template"""
    form_schema = {
        "fields": [
            {
                "id": "visit_type",
                "type": "radio",
                "label": "Visit Type",
                "required": True,
                "options": ["First Visit", "Follow-up"]
            },
            {
                "id": "chief_complaint",
                "type": "textarea",
                "label": "Chief Complaint",
                "required": True,
                "placeholder": "Main reason for today's visit"
            },
            {
                "id": "symptom_duration",
                "type": "text",
                "label": "Duration of Symptoms",
                "required": True,
                "placeholder": "e.g., 3 days, 2 weeks"
            },
            {
                "id": "symptom_severity",
                "type": "linearScale",
                "label": "Symptom Severity",
                "required": True,
                "min": 1,
                "max": 10,
                "minLabel": "Mild",
                "maxLabel": "Severe"
            },
            {
                "id": "associated_symptoms",
                "type": "checkbox",
                "label": "Associated Symptoms (check all that apply)",
                "options": [
                    "Fever",
                    "Headache",
                    "Nausea",
                    "Vomiting",
                    "Diarrhea",
                    "Cough",
                    "Shortness of breath",
                    "Chest pain",
                    "Abdominal pain",
                    "Fatigue",
                    "Loss of appetite",
                    "Weight loss"
                ]
            },
            {
                "id": "vital_signs_section",
                "type": "section",
                "label": "Vital Signs"
            },
            {
                "id": "blood_pressure",
                "type": "text",
                "label": "Blood Pressure (mmHg)",
                "required": False
            },
            {
                "id": "pulse_rate",
                "type": "number",
                "label": "Pulse Rate (bpm)",
                "required": False
            },
            {
                "id": "weight",
                "type": "number",
                "label": "Weight (kg)",
                "required": False
            },
            {
                "id": "height",
                "type": "number",
                "label": "Height (cm)",
                "required": False
            },
            {
                "id": "previous_treatment",
                "type": "textarea",
                "label": "Previous Treatment Taken",
                "required": False,
                "placeholder": "Any medications or treatments already tried"
            },
            {
                "id": "allergies",
                "type": "text",
                "label": "Known Allergies",
                "required": False
            },
            {
                "id": "family_history",
                "type": "textarea",
                "label": "Relevant Family History",
                "required": False
            },
            {
                "id": "lifestyle_section",
                "type": "section",
                "label": "Lifestyle Factors"
            },
            {
                "id": "smoking",
                "type": "radio",
                "label": "Smoking",
                "options": ["Never", "Former", "Current"]
            },
            {
                "id": "alcohol",
                "type": "radio",
                "label": "Alcohol Consumption",
                "options": ["Never", "Occasional", "Regular"]
            },
            {
                "id": "exercise",
                "type": "radio",
                "label": "Exercise Frequency",
                "options": ["None", "1-2 times/week", "3-4 times/week", "Daily"]
            }
        ]
    }

    return Form(
        name="OPD Consultation Form",
        description="Standard consultation form for out-patient department",
        schema=json.dumps(form_schema),
        is_template=True,
        template_category="opd",
        version=1,
        is_active=True,
        is_public=False
    )


def create_physiotherapy_assessment_form():
    """Create physiotherapy assessment form template"""
    form_schema = {
        "fields": [
            {
                "id": "referral_source",
                "type": "select",
                "label": "Referral Source",
                "required": True,
                "options": ["Orthopedician", "Neurologist", "General Physician", "Self", "Other"]
            },
            {
                "id": "diagnosis",
                "type": "text",
                "label": "Medical Diagnosis",
                "required": True
            },
            {
                "id": "onset_date",
                "type": "date",
                "label": "Date of Onset/Injury",
                "required": True
            },
            {
                "id": "mechanism_of_injury",
                "type": "textarea",
                "label": "Mechanism of Injury",
                "required": False,
                "placeholder": "How did the injury occur?"
            },
            {
                "id": "pain_section",
                "type": "section",
                "label": "Pain Assessment"
            },
            {
                "id": "pain_location",
                "type": "text",
                "label": "Primary Pain Location",
                "required": True
            },
            {
                "id": "pain_scale",
                "type": "painScale",
                "label": "Current Pain Level",
                "required": True,
                "min": 0,
                "max": 10
            },
            {
                "id": "pain_type",
                "type": "checkbox",
                "label": "Pain Characteristics",
                "options": ["Sharp", "Dull", "Throbbing", "Burning", "Shooting", "Constant", "Intermittent"]
            },
            {
                "id": "aggravating_factors",
                "type": "textarea",
                "label": "Aggravating Factors",
                "placeholder": "What makes the pain worse?"
            },
            {
                "id": "relieving_factors",
                "type": "textarea",
                "label": "Relieving Factors",
                "placeholder": "What makes the pain better?"
            },
            {
                "id": "functional_section",
                "type": "section",
                "label": "Functional Assessment"
            },
            {
                "id": "mobility_status",
                "type": "select",
                "label": "Current Mobility Status",
                "required": True,
                "options": [
                    "Independent",
                    "Uses cane",
                    "Uses walker",
                    "Uses crutches",
                    "Wheelchair bound",
                    "Bedridden"
                ]
            },
            {
                "id": "range_of_motion",
                "type": "select",
                "label": "Range of Motion",
                "required": True,
                "options": ["Full", "Mildly Limited", "Moderately Limited", "Severely Limited"]
            },
            {
                "id": "muscle_strength",
                "type": "linearScale",
                "label": "Overall Muscle Strength",
                "min": 0,
                "max": 5,
                "minLabel": "No contraction",
                "maxLabel": "Normal strength"
            },
            {
                "id": "balance",
                "type": "radio",
                "label": "Balance Assessment",
                "options": ["Good", "Fair", "Poor", "Unable to assess"]
            },
            {
                "id": "previous_therapy",
                "type": "radio",
                "label": "Previous Physiotherapy",
                "required": True,
                "options": ["Yes", "No"]
            },
            {
                "id": "previous_therapy_details",
                "type": "textarea",
                "label": "If yes, provide details",
                "required": False,
                "visibleWhen": {
                    "field": "previous_therapy",
                    "value": "Yes"
                }
            },
            {
                "id": "treatment_goals",
                "type": "textarea",
                "label": "Patient's Treatment Goals",
                "required": True,
                "placeholder": "What do you hope to achieve from physiotherapy?"
            },
            {
                "id": "medical_precautions",
                "type": "checkbox",
                "label": "Medical Precautions/Contraindications",
                "options": [
                    "Cardiac conditions",
                    "Respiratory conditions",
                    "Recent surgery",
                    "Osteoporosis",
                    "Pregnancy",
                    "Metal implants",
                    "Pacemaker",
                    "None"
                ]
            },
            {
                "id": "consent_treatment",
                "type": "checkbox",
                "label": "I consent to physiotherapy assessment and treatment",
                "required": True
            }
        ]
    }

    return Form(
        name="Physiotherapy Assessment Form",
        description="Initial assessment form for physiotherapy services",
        schema=json.dumps(form_schema),
        is_template=True,
        template_category="physiotherapy",
        version=1,
        is_active=True,
        is_public=False
    )


def create_home_care_assessment_form():
    """Create home care assessment form template"""
    form_schema = {
        "fields": [
            {
                "id": "service_type",
                "type": "checkbox",
                "label": "Services Required",
                "required": True,
                "options": [
                    "Nursing Care",
                    "Wound Dressing",
                    "Injection Administration",
                    "IV Therapy",
                    "Catheter Care",
                    "Vital Monitoring",
                    "Sample Collection",
                    "Physiotherapy",
                    "Post-operative Care",
                    "Elderly Care",
                    "Palliative Care"
                ]
            },
            {
                "id": "frequency",
                "type": "select",
                "label": "Service Frequency",
                "required": True,
                "options": ["Daily", "Alternate Days", "Twice a Week", "Weekly", "As Needed"]
            },
            {
                "id": "preferred_time",
                "type": "select",
                "label": "Preferred Time Slot",
                "required": True,
                "options": ["Morning (6-12 PM)", "Afternoon (12-5 PM)", "Evening (5-9 PM)", "Night (9 PM-6 AM)", "Flexible"]
            },
            {
                "id": "patient_mobility",
                "type": "select",
                "label": "Patient Mobility Status",
                "required": True,
                "options": ["Ambulatory", "Needs Assistance", "Wheelchair Bound", "Bedridden"]
            },
            {
                "id": "living_arrangement",
                "type": "radio",
                "label": "Living Arrangement",
                "required": True,
                "options": ["Lives Alone", "With Family", "With Caregiver"]
            },
            {
                "id": "medical_conditions",
                "type": "textarea",
                "label": "Current Medical Conditions",
                "required": True,
                "placeholder": "List all current medical conditions"
            },
            {
                "id": "medications",
                "type": "textarea",
                "label": "Current Medications",
                "required": True,
                "placeholder": "List all medications with dosage and frequency"
            },
            {
                "id": "allergies",
                "type": "textarea",
                "label": "Known Allergies",
                "required": True,
                "placeholder": "List all known allergies"
            },
            {
                "id": "equipment_section",
                "type": "section",
                "label": "Equipment at Home"
            },
            {
                "id": "available_equipment",
                "type": "checkbox",
                "label": "Equipment Available at Home",
                "options": [
                    "Hospital Bed",
                    "Wheelchair",
                    "Walker",
                    "Oxygen Concentrator",
                    "Nebulizer",
                    "BP Monitor",
                    "Glucometer",
                    "Pulse Oximeter",
                    "None"
                ]
            },
            {
                "id": "equipment_needed",
                "type": "textarea",
                "label": "Equipment/Supplies Needed",
                "required": False,
                "placeholder": "List any equipment or supplies that need to be arranged"
            },
            {
                "id": "home_environment",
                "type": "textarea",
                "label": "Home Environment Details",
                "required": False,
                "placeholder": "Stairs, elevator availability, bathroom accessibility, etc."
            },
            {
                "id": "caregiver_section",
                "type": "section",
                "label": "Primary Caregiver Information"
            },
            {
                "id": "caregiver_name",
                "type": "text",
                "label": "Caregiver Name",
                "required": True
            },
            {
                "id": "caregiver_relation",
                "type": "text",
                "label": "Relationship to Patient",
                "required": True
            },
            {
                "id": "caregiver_phone",
                "type": "phone",
                "label": "Caregiver Contact Number",
                "required": True
            },
            {
                "id": "caregiver_availability",
                "type": "radio",
                "label": "Caregiver Availability",
                "options": ["Always Present", "Daytime Only", "Night Only", "Occasional"]
            },
            {
                "id": "special_instructions",
                "type": "textarea",
                "label": "Special Instructions",
                "required": False,
                "placeholder": "Any specific instructions for the healthcare provider"
            },
            {
                "id": "emergency_plan",
                "type": "textarea",
                "label": "Emergency Plan",
                "required": True,
                "placeholder": "What to do in case of emergency, nearest hospital, etc."
            },
            {
                "id": "consent_home_care",
                "type": "checkbox",
                "label": "I consent to home healthcare services and understand the terms",
                "required": True
            }
        ]
    }

    return Form(
        name="Home Care Assessment Form",
        description="Comprehensive assessment for home healthcare services",
        schema=json.dumps(form_schema),
        is_template=True,
        template_category="home_care",
        version=1,
        is_active=True,
        is_public=False
    )


def seed_service_forms():
    """Create and link forms to services"""

    created_forms = []
    linked_forms = []
    errors = []

    try:
        # Create form templates
        forms_to_create = [
            create_ipd_admission_form(),
            create_opd_consultation_form(),
            create_physiotherapy_assessment_form(),
            create_home_care_assessment_form()
        ]

        for form in forms_to_create:
            try:
                # Check if form already exists
                existing = db.session.query(Form).filter(
                    Form.name == form.name
                ).first()

                if not existing:
                    db.session.add(form)
                    created_forms.append(form.name)
                    print(f"✓ Created form: {form.name}")
                else:
                    form = existing
                    print(f"Form '{form.name}' already exists. Using existing form.")

            except Exception as e:
                errors.append(f"Error creating {form.name}: {str(e)}")
                print(f"✗ Failed to create {form.name}: {str(e)}")

        # Commit forms
        if created_forms:
            db.session.commit()
            print(f"\n✓ Successfully created {len(created_forms)} forms")

        # Link forms to services
        print("\nLinking forms to services...")

        # Get all forms
        ipd_form = db.session.query(Form).filter(
            Form.name == "IPD Admission Form"
        ).first()
        opd_form = db.session.query(Form).filter(
            Form.name == "OPD Consultation Form"
        ).first()
        physio_form = db.session.query(Form).filter(
            Form.name == "Physiotherapy Assessment Form"
        ).first()
        home_care_form = db.session.query(Form).filter(
            Form.name == "Home Care Assessment Form"
        ).first()

        # Get services
        from app.services.models import ServiceType

        ipd_service = db.session.query(Service).filter(
            Service.service_type == ServiceType.IPD
        ).first()
        opd_service = db.session.query(Service).filter(
            Service.service_type == ServiceType.OPD
        ).first()
        physio_service = db.session.query(Service).filter(
            Service.service_type == ServiceType.PHYSIOTHERAPY
        ).first()
        home_care_service = db.session.query(Service).filter(
            Service.service_type == ServiceType.HOME_CARE
        ).first()

        # Link forms to services
        form_assignments = [
            (ipd_service, ipd_form, 'INITIAL', True, 1),
            (opd_service, opd_form, 'INITIAL', True, 1),
            (physio_service, physio_form, 'ASSESSMENT', True, 1),
            (home_care_service, home_care_form, 'ASSESSMENT', True, 1)
        ]

        for service, form, form_type, is_mandatory, order in form_assignments:
            if service and form:
                try:
                    # Check if already linked
                    existing_link = db.session.query(ServiceForm).filter(
                        ServiceForm.service_id == service.id,
                        ServiceForm.form_id == form.id
                    ).first()

                    if not existing_link:
                        success, message = ServiceService.assign_form_to_service(
                            str(service.id),
                            str(form.id),
                            form_type,
                            is_mandatory,
                            order
                        )

                        if success:
                            linked_forms.append(f"{service.name} → {form.name}")
                            print(f"✓ Linked {form.name} to {service.name}")
                        else:
                            print(f"✗ Failed to link {form.name} to {service.name}: {message}")
                    else:
                        print(f"Form '{form.name}' already linked to {service.name}")

                except Exception as e:
                    errors.append(f"Error linking {form.name} to {service.name}: {str(e)}")
                    print(f"✗ Error: {str(e)}")

        # Also update services to set default forms
        if ipd_service and ipd_form:
            ipd_service.intake_form_id = ipd_form.id

        if opd_service and opd_form:
            opd_service.default_form_id = opd_form.id

        if physio_service and physio_form:
            physio_service.default_form_id = physio_form.id

        if home_care_service and home_care_form:
            home_care_service.default_form_id = home_care_form.id

        db.session.commit()
        print("✓ Updated service default forms")

    except Exception as e:
        db.session.rollback()
        print(f"✗ Critical error: {str(e)}")
        return False

    # Print summary
    print("\n" + "="*50)
    print("SEED SERVICE FORMS SUMMARY")
    print("="*50)

    if created_forms:
        print(f"✓ Created {len(created_forms)} forms:")
        for name in created_forms:
            print(f"  - {name}")

    if linked_forms:
        print(f"\n✓ Linked {len(linked_forms)} forms to services:")
        for link in linked_forms:
            print(f"  - {link}")

    if errors:
        print(f"\n✗ {len(errors)} errors occurred:")
        for error in errors:
            print(f"  - {error}")

    return True


def main():
    """Main function"""
    app = create_app('development')

    with app.app_context():
        print("Seeding service forms...")
        success = seed_service_forms()

        if success:
            print("\n✅ Service form seeding completed successfully!")
            return 0
        else:
            print("\n❌ Service form seeding failed!")
            return 1


if __name__ == '__main__':
    sys.exit(main())