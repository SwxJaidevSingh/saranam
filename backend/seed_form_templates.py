"""
Seed script for healthcare form templates.
Run this script to populate the database with pre-built healthcare form templates.

Usage:
    python seed_form_templates.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.forms.models import Form

# Healthcare Form Templates
FORM_TEMPLATES = [
    {
        "name": "Physiotherapy Assessment",
        "description": "Comprehensive physiotherapy intake and assessment form for musculoskeletal conditions",
        "template_category": "physiotherapy",
        "template_description": "Multi-page form for initial physiotherapy assessment covering patient history, pain evaluation, functional status, and treatment goals. Includes specialized fields for range of motion, strength testing, and mobility assessment.",
        "is_template": True,
        "schema": {
            "pages": [
                {
                    "id": "page_1_patient_info",
                    "title": "Patient Information & Chief Complaint",
                    "fields": [
                        {
                            "id": "patient_name",
                            "type": "text",
                            "label": "Patient Name",
                            "required": True,
                            "placeholder": "Full name"
                        },
                        {
                            "id": "date_of_birth",
                            "type": "date",
                            "label": "Date of Birth",
                            "required": True
                        },
                        {
                            "id": "gender",
                            "type": "radio",
                            "label": "Gender",
                            "required": True,
                            "options": ["Male", "Female", "Other"]
                        },
                        {
                            "id": "chief_complaint",
                            "type": "textarea",
                            "label": "Chief Complaint",
                            "required": True,
                            "placeholder": "Describe the primary reason for seeking physiotherapy...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "onset_date",
                            "type": "date",
                            "label": "Date of Injury/Onset",
                            "required": True
                        },
                        {
                            "id": "mechanism_of_injury",
                            "type": "select",
                            "label": "Mechanism of Injury",
                            "required": False,
                            "options": [
                                "Sudden trauma",
                                "Repetitive stress",
                                "Post-surgical",
                                "Degenerative",
                                "Unknown",
                                "Other"
                            ]
                        },
                        {
                            "id": "previous_treatment",
                            "type": "checkbox",
                            "label": "Previous Treatment Received",
                            "required": False,
                            "options": [
                                "Physiotherapy",
                                "Medication",
                                "Surgery",
                                "Massage",
                                "Chiropractic",
                                "None"
                            ]
                        }
                    ]
                },
                {
                    "id": "page_2_pain_vitals",
                    "title": "Pain Assessment & Vitals",
                    "fields": [
                        {
                            "id": "pain_location",
                            "type": "select",
                            "label": "Primary Pain Location",
                            "required": True,
                            "options": [
                                "Neck",
                                "Shoulder (Left)",
                                "Shoulder (Right)",
                                "Upper Back",
                                "Lower Back",
                                "Elbow (Left)",
                                "Elbow (Right)",
                                "Wrist/Hand (Left)",
                                "Wrist/Hand (Right)",
                                "Hip (Left)",
                                "Hip (Right)",
                                "Knee (Left)",
                                "Knee (Right)",
                                "Ankle/Foot (Left)",
                                "Ankle/Foot (Right)",
                                "Multiple Locations"
                            ]
                        },
                        {
                            "id": "pain_intensity_rest",
                            "type": "painScale",
                            "label": "Pain Intensity at Rest (0-10)",
                            "required": True,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "scaleSize": 10,
                                "showEmojis": True,
                                "showMainLabels": True
                            },
                            "clinicalMapping": {
                                "observationType": "pain_scale",
                                "loincCode": "72514-3",
                                "unit": "score",
                                "category": "survey"
                            }
                        },
                        {
                            "id": "pain_intensity_activity",
                            "type": "painScale",
                            "label": "Pain Intensity with Activity (0-10)",
                            "required": True,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "scaleSize": 10,
                                "showEmojis": True,
                                "showMainLabels": True
                            }
                        },
                        {
                            "id": "pain_character",
                            "type": "checkbox",
                            "label": "Pain Character",
                            "required": True,
                            "options": [
                                "Sharp",
                                "Dull",
                                "Aching",
                                "Burning",
                                "Stabbing",
                                "Throbbing",
                                "Shooting",
                                "Tingling",
                                "Numbness"
                            ]
                        },
                        {
                            "id": "pain_aggravating_factors",
                            "type": "textarea",
                            "label": "Aggravating Factors",
                            "required": False,
                            "placeholder": "What makes the pain worse?",
                            "validation": {"maxLength": 300}
                        },
                        {
                            "id": "pain_relieving_factors",
                            "type": "textarea",
                            "label": "Relieving Factors",
                            "required": False,
                            "placeholder": "What makes the pain better?",
                            "validation": {"maxLength": 300}
                        },
                        {
                            "id": "bp_systolic",
                            "type": "number",
                            "label": "Blood Pressure (Systolic)",
                            "placeholder": "e.g., 120",
                            "required": False,
                            "validation": {"min": 60, "max": 250},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "bp_diastolic",
                            "type": "number",
                            "label": "Blood Pressure (Diastolic)",
                            "placeholder": "e.g., 80",
                            "required": False,
                            "validation": {"min": 40, "max": 150},
                            "config": {"allowDecimals": False}
                        }
                    ]
                },
                {
                    "id": "page_3_functional",
                    "title": "Functional Assessment",
                    "fields": [
                        {
                            "id": "walking_ability",
                            "type": "severityRating",
                            "label": "Walking Ability",
                            "required": True,
                            "config": {
                                "levels": ["Independent", "With aid (cane/walker)", "With assistance", "Unable"],
                                "scores": [0, 1, 2, 3],
                                "colors": ["#22c55e", "#eab308", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "mobility_aids",
                            "type": "checkbox",
                            "label": "Mobility Aids Used",
                            "required": False,
                            "options": [
                                "Cane",
                                "Walker",
                                "Wheelchair",
                                "Crutches",
                                "None"
                            ]
                        },
                        {
                            "id": "adl_independence",
                            "type": "linearScale",
                            "label": "Activities of Daily Living (ADL) Independence",
                            "required": True,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "minLabel": "Fully Dependent",
                                "maxLabel": "Fully Independent"
                            }
                        },
                        {
                            "id": "adl_limitations",
                            "type": "checkbox",
                            "label": "ADL Limitations",
                            "required": False,
                            "options": [
                                "Dressing",
                                "Bathing",
                                "Eating",
                                "Toileting",
                                "Transfers (bed/chair)",
                                "Walking",
                                "Climbing stairs",
                                "None"
                            ]
                        },
                        {
                            "id": "work_status",
                            "type": "select",
                            "label": "Current Work Status",
                            "required": False,
                            "options": [
                                "Working full-time",
                                "Working part-time",
                                "On medical leave",
                                "Modified duties",
                                "Retired",
                                "Unemployed",
                                "Student"
                            ]
                        },
                        {
                            "id": "functional_goals",
                            "type": "textarea",
                            "label": "Patient's Functional Goals",
                            "required": True,
                            "placeholder": "What activities does the patient want to be able to do?",
                            "validation": {"maxLength": 500}
                        }
                    ]
                },
                {
                    "id": "page_4_assessment_plan",
                    "title": "Clinical Assessment & Treatment Plan",
                    "fields": [
                        {
                            "id": "range_of_motion",
                            "type": "select",
                            "label": "Range of Motion",
                            "required": True,
                            "options": [
                                "Normal",
                                "Mildly limited",
                                "Moderately limited",
                                "Severely limited"
                            ]
                        },
                        {
                            "id": "muscle_strength",
                            "type": "select",
                            "label": "Muscle Strength",
                            "required": True,
                            "options": [
                                "5/5 (Normal)",
                                "4/5 (Good)",
                                "3/5 (Fair)",
                                "2/5 (Poor)",
                                "1/5 (Trace)",
                                "0/5 (None)"
                            ]
                        },
                        {
                            "id": "balance_assessment",
                            "type": "severityRating",
                            "label": "Balance",
                            "required": True,
                            "config": {
                                "levels": ["Excellent", "Good", "Fair", "Poor"],
                                "scores": [0, 1, 2, 3],
                                "colors": ["#22c55e", "#84cc16", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "special_tests",
                            "type": "textarea",
                            "label": "Special Tests Performed",
                            "required": False,
                            "placeholder": "List any special orthopedic tests and results...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "clinical_impression",
                            "type": "textarea",
                            "label": "Clinical Impression/Diagnosis",
                            "required": True,
                            "placeholder": "Primary diagnosis and contributing factors...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "treatment_plan",
                            "type": "textarea",
                            "label": "Treatment Plan",
                            "required": True,
                            "placeholder": "Outline the proposed treatment approach...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "treatment_frequency",
                            "type": "select",
                            "label": "Recommended Treatment Frequency",
                            "required": True,
                            "options": [
                                "1x per week",
                                "2x per week",
                                "3x per week",
                                "Daily",
                                "As needed"
                            ]
                        },
                        {
                            "id": "estimated_duration",
                            "type": "select",
                            "label": "Estimated Treatment Duration",
                            "required": False,
                            "options": [
                                "2-4 weeks",
                                "4-6 weeks",
                                "6-8 weeks",
                                "8-12 weeks",
                                "More than 12 weeks"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        "name": "MSW Counselling Assessment",
        "description": "Medical Social Worker counselling intake and psychosocial assessment form",
        "template_category": "msw",
        "template_description": "Comprehensive assessment tool for medical social workers to evaluate patient's psychosocial needs, mental health status, family dynamics, and social support systems. Includes sections for crisis assessment and intervention planning.",
        "is_template": True,
        "schema": {
            "pages": [
                {
                    "id": "page_1_demographics",
                    "title": "Demographics & Referral Information",
                    "fields": [
                        {
                            "id": "patient_name",
                            "type": "text",
                            "label": "Patient Name",
                            "required": True,
                            "placeholder": "Full name"
                        },
                        {
                            "id": "date_of_birth",
                            "type": "date",
                            "label": "Date of Birth",
                            "required": True
                        },
                        {
                            "id": "gender",
                            "type": "radio",
                            "label": "Gender",
                            "required": True,
                            "options": ["Male", "Female", "Other", "Prefer not to say"]
                        },
                        {
                            "id": "marital_status",
                            "type": "select",
                            "label": "Marital Status",
                            "required": False,
                            "options": [
                                "Single",
                                "Married",
                                "Divorced",
                                "Widowed",
                                "Separated",
                                "Domestic Partnership"
                            ]
                        },
                        {
                            "id": "education_level",
                            "type": "select",
                            "label": "Education Level",
                            "required": False,
                            "options": [
                                "No formal education",
                                "Primary school",
                                "Secondary school",
                                "High school graduate",
                                "Some college",
                                "College graduate",
                                "Postgraduate degree"
                            ]
                        },
                        {
                            "id": "referral_source",
                            "type": "select",
                            "label": "Referral Source",
                            "required": True,
                            "options": [
                                "Self-referred",
                                "Physician",
                                "Nurse",
                                "Family member",
                                "Hospital discharge planner",
                                "Community organization",
                                "Other"
                            ]
                        },
                        {
                            "id": "referral_reason",
                            "type": "textarea",
                            "label": "Reason for Referral",
                            "required": True,
                            "placeholder": "Describe the primary reason for social work intervention...",
                            "validation": {"maxLength": 500}
                        }
                    ]
                },
                {
                    "id": "page_2_psychosocial",
                    "title": "Psychosocial Assessment",
                    "fields": [
                        {
                            "id": "living_situation",
                            "type": "select",
                            "label": "Current Living Situation",
                            "required": True,
                            "options": [
                                "Lives alone",
                                "Lives with spouse/partner",
                                "Lives with family members",
                                "Lives with caregiver",
                                "Assisted living facility",
                                "Nursing home",
                                "Homeless",
                                "Transitional housing"
                            ]
                        },
                        {
                            "id": "primary_caregiver",
                            "type": "text",
                            "label": "Primary Caregiver Name",
                            "required": False,
                            "placeholder": "Name of primary support person",
                            "validation": {"maxLength": 100}
                        },
                        {
                            "id": "caregiver_relationship",
                            "type": "select",
                            "label": "Caregiver Relationship",
                            "required": False,
                            "options": [
                                "Spouse/Partner",
                                "Parent",
                                "Child",
                                "Sibling",
                                "Other family member",
                                "Friend",
                                "Professional caregiver",
                                "None"
                            ]
                        },
                        {
                            "id": "support_network",
                            "type": "checkbox",
                            "label": "Available Support Systems",
                            "required": True,
                            "options": [
                                "Family nearby",
                                "Friends/neighbors",
                                "Community services",
                                "Religious/spiritual support",
                                "Professional caregivers",
                                "Support groups",
                                "Limited/no support"
                            ]
                        },
                        {
                            "id": "mood_assessment",
                            "type": "select",
                            "label": "Current Mood",
                            "required": True,
                            "options": [
                                "Good/stable",
                                "Fair",
                                "Low/depressed",
                                "Anxious",
                                "Irritable",
                                "Confused",
                                "Angry",
                                "Hopeless"
                            ]
                        },
                        {
                            "id": "sleep_quality",
                            "type": "severityRating",
                            "label": "Sleep Quality",
                            "required": True,
                            "config": {
                                "levels": ["Excellent", "Good", "Fair", "Poor", "Very Poor"],
                                "scores": [0, 1, 2, 3, 4],
                                "colors": ["#22c55e", "#84cc16", "#eab308", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "appetite",
                            "type": "severityRating",
                            "label": "Appetite",
                            "required": True,
                            "config": {
                                "levels": ["Normal", "Increased", "Decreased", "Very Poor"],
                                "scores": [0, 1, 2, 3],
                                "colors": ["#22c55e", "#eab308", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "financial_concerns",
                            "type": "radio",
                            "label": "Financial Concerns Related to Healthcare",
                            "required": True,
                            "options": [
                                "No concerns",
                                "Some concerns",
                                "Major concerns",
                                "Cannot afford care",
                                "Prefer not to say"
                            ]
                        },
                        {
                            "id": "employment_status",
                            "type": "select",
                            "label": "Employment Status",
                            "required": False,
                            "options": [
                                "Employed full-time",
                                "Employed part-time",
                                "Unemployed",
                                "On disability",
                                "Retired",
                                "Student",
                                "Homemaker"
                            ]
                        }
                    ]
                },
                {
                    "id": "page_3_intervention",
                    "title": "Crisis Assessment & Intervention Plan",
                    "fields": [
                        {
                            "id": "substance_use",
                            "type": "checkbox",
                            "label": "Substance Use (Current or Past)",
                            "required": False,
                            "options": [
                                "Alcohol",
                                "Tobacco",
                                "Prescription medications",
                                "Illicit drugs",
                                "None"
                            ]
                        },
                        {
                            "id": "abuse_concerns",
                            "type": "checkbox",
                            "label": "Safety Concerns",
                            "required": True,
                            "options": [
                                "Domestic violence",
                                "Elder abuse",
                                "Child abuse/neglect",
                                "Self-harm risk",
                                "Suicidal ideation",
                                "None identified"
                            ]
                        },
                        {
                            "id": "safety_plan_needed",
                            "type": "radio",
                            "label": "Is a Safety Plan Required?",
                            "required": True,
                            "options": ["Yes", "No"]
                        },
                        {
                            "id": "coping_mechanisms",
                            "type": "checkbox",
                            "label": "Current Coping Mechanisms",
                            "required": False,
                            "options": [
                                "Exercise",
                                "Meditation/prayer",
                                "Social activities",
                                "Hobbies",
                                "Talking to friends/family",
                                "Professional counseling",
                                "Substance use",
                                "Isolation",
                                "Other"
                            ]
                        },
                        {
                            "id": "patient_strengths",
                            "type": "textarea",
                            "label": "Patient Strengths & Resources",
                            "required": True,
                            "placeholder": "Identify patient's strengths and available resources...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "barriers_to_care",
                            "type": "textarea",
                            "label": "Identified Barriers to Care",
                            "required": True,
                            "placeholder": "Transportation, financial, language, etc...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "intervention_plan",
                            "type": "textarea",
                            "label": "Intervention Plan & Goals",
                            "required": True,
                            "placeholder": "Outline short-term and long-term goals...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "referrals_made",
                            "type": "checkbox",
                            "label": "Referrals Made",
                            "required": False,
                            "options": [
                                "Mental health services",
                                "Substance abuse treatment",
                                "Housing assistance",
                                "Financial assistance",
                                "Legal services",
                                "Support groups",
                                "Community resources",
                                "Home health services",
                                "None at this time"
                            ]
                        },
                        {
                            "id": "follow_up_plan",
                            "type": "select",
                            "label": "Follow-up Plan",
                            "required": True,
                            "options": [
                                "Weekly contact",
                                "Bi-weekly contact",
                                "Monthly contact",
                                "As needed",
                                "Case closed"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        "name": "OPD General Assessment",
        "description": "Outpatient department general medical assessment form",
        "template_category": "opd",
        "template_description": "Standard OPD assessment form for general medical consultations. Covers presenting complaints, vital signs, physical examination findings, and treatment plan for outpatient visits.",
        "is_template": True,
        "schema": {
            "pages": [
                {
                    "id": "page_1_patient_vitals",
                    "title": "Patient Details & Vital Signs",
                    "fields": [
                        {
                            "id": "patient_name",
                            "type": "text",
                            "label": "Patient Name",
                            "required": True,
                            "placeholder": "Full name"
                        },
                        {
                            "id": "patient_id",
                            "type": "text",
                            "label": "Patient ID / MRN",
                            "required": True,
                            "placeholder": "Medical Record Number"
                        },
                        {
                            "id": "date_of_birth",
                            "type": "date",
                            "label": "Date of Birth",
                            "required": True
                        },
                        {
                            "id": "gender",
                            "type": "radio",
                            "label": "Gender",
                            "required": True,
                            "options": ["Male", "Female", "Other"]
                        },
                        {
                            "id": "contact_number",
                            "type": "phone",
                            "label": "Contact Number",
                            "required": True,
                            "config": {"defaultCountryCode": "+91"}
                        },
                        {
                            "id": "visit_type",
                            "type": "select",
                            "label": "Visit Type",
                            "required": True,
                            "options": [
                                "New patient",
                                "Follow-up",
                                "Urgent consultation",
                                "Medication review",
                                "Test results review"
                            ]
                        },
                        {
                            "id": "chief_complaint",
                            "type": "textarea",
                            "label": "Chief Complaint",
                            "required": True,
                            "placeholder": "Primary reason for visit...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "bp_systolic",
                            "type": "number",
                            "label": "Blood Pressure (Systolic)",
                            "placeholder": "e.g., 120",
                            "required": True,
                            "validation": {"min": 60, "max": 250},
                            "config": {"allowDecimals": False},
                            "clinicalMapping": {
                                "observationType": "bp_systolic",
                                "loincCode": "8480-6",
                                "unit": "mmHg",
                                "category": "vital-signs"
                            }
                        },
                        {
                            "id": "bp_diastolic",
                            "type": "number",
                            "label": "Blood Pressure (Diastolic)",
                            "placeholder": "e.g., 80",
                            "required": True,
                            "validation": {"min": 40, "max": 150},
                            "config": {"allowDecimals": False},
                            "clinicalMapping": {
                                "observationType": "bp_diastolic",
                                "loincCode": "8462-4",
                                "unit": "mmHg",
                                "category": "vital-signs"
                            }
                        },
                        {
                            "id": "heart_rate",
                            "type": "number",
                            "label": "Heart Rate",
                            "placeholder": "e.g., 72",
                            "required": True,
                            "validation": {"min": 30, "max": 200},
                            "config": {"allowDecimals": False},
                            "clinicalMapping": {
                                "observationType": "heart_rate",
                                "loincCode": "8867-4",
                                "unit": "bpm",
                                "category": "vital-signs"
                            }
                        },
                        {
                            "id": "temperature",
                            "type": "number",
                            "label": "Temperature (°F)",
                            "placeholder": "e.g., 98.6",
                            "required": True,
                            "validation": {"min": 95, "max": 106},
                            "config": {"allowDecimals": True, "decimalPlaces": 1},
                            "clinicalMapping": {
                                "observationType": "temperature",
                                "loincCode": "8310-5",
                                "unit": "°F",
                                "category": "vital-signs"
                            }
                        },
                        {
                            "id": "spo2",
                            "type": "number",
                            "label": "SpO2 (Oxygen Saturation)",
                            "placeholder": "e.g., 98",
                            "required": False,
                            "validation": {"min": 60, "max": 100},
                            "config": {"allowDecimals": False},
                            "clinicalMapping": {
                                "observationType": "spo2",
                                "loincCode": "2708-6",
                                "unit": "%",
                                "category": "vital-signs"
                            }
                        },
                        {
                            "id": "weight",
                            "type": "number",
                            "label": "Weight (kg)",
                            "placeholder": "e.g., 70.5",
                            "required": False,
                            "validation": {"min": 20, "max": 300},
                            "config": {"allowDecimals": True, "decimalPlaces": 1}
                        }
                    ]
                },
                {
                    "id": "page_2_assessment_plan",
                    "title": "Assessment & Treatment Plan",
                    "fields": [
                        {
                            "id": "medical_history",
                            "type": "textarea",
                            "label": "Relevant Medical History",
                            "required": False,
                            "placeholder": "Past medical history, chronic conditions...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "current_medications",
                            "type": "textarea",
                            "label": "Current Medications",
                            "required": False,
                            "placeholder": "List current medications and dosages...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "allergies",
                            "type": "text",
                            "label": "Known Allergies",
                            "required": False,
                            "placeholder": "Drug or food allergies"
                        },
                        {
                            "id": "symptoms_checklist",
                            "type": "symptomChecklist",
                            "label": "Current Symptoms",
                            "required": False,
                            "config": {
                                "symptoms": ["Pain", "Fever", "Cough", "Fatigue", "Nausea", "Dizziness", "Shortness of Breath"],
                                "severityLevels": ["Mild", "Moderate", "Severe"],
                                "allowMultiple": True,
                                "showSeverity": True
                            }
                        },
                        {
                            "id": "physical_examination",
                            "type": "textarea",
                            "label": "Physical Examination Findings",
                            "required": True,
                            "placeholder": "General appearance, system-wise examination findings...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "provisional_diagnosis",
                            "type": "textarea",
                            "label": "Provisional Diagnosis",
                            "required": True,
                            "placeholder": "Primary and secondary diagnoses...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "investigations_ordered",
                            "type": "checkbox",
                            "label": "Investigations Ordered",
                            "required": False,
                            "options": [
                                "Blood tests (CBC, etc.)",
                                "Urinalysis",
                                "X-ray",
                                "ECG",
                                "Ultrasound",
                                "CT scan",
                                "MRI",
                                "Other tests",
                                "None"
                            ]
                        },
                        {
                            "id": "treatment_prescribed",
                            "type": "textarea",
                            "label": "Treatment Plan & Prescriptions",
                            "required": True,
                            "placeholder": "Medications prescribed, dosage, duration...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "patient_advice",
                            "type": "textarea",
                            "label": "Patient Advice & Instructions",
                            "required": False,
                            "placeholder": "Lifestyle modifications, precautions, diet advice...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "follow_up_needed",
                            "type": "radio",
                            "label": "Follow-up Required?",
                            "required": True,
                            "options": ["Yes", "No", "As needed"]
                        },
                        {
                            "id": "follow_up_duration",
                            "type": "select",
                            "label": "Follow-up Timeline",
                            "required": False,
                            "options": [
                                "3 days",
                                "1 week",
                                "2 weeks",
                                "1 month",
                                "3 months",
                                "As per test results"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        "name": "IPD Admission Assessment",
        "description": "Inpatient department comprehensive admission assessment form",
        "template_category": "ipd",
        "template_description": "Detailed IPD admission assessment covering patient demographics, medical history, presenting condition, vital signs, risk assessment, and admission plan. Includes geriatric screening and fall risk assessment.",
        "is_template": True,
        "schema": {
            "pages": [
                {
                    "id": "page_1_admission_details",
                    "title": "Admission Details & Patient Information",
                    "fields": [
                        {
                            "id": "patient_name",
                            "type": "text",
                            "label": "Patient Name",
                            "required": True,
                            "placeholder": "Full name"
                        },
                        {
                            "id": "patient_id",
                            "type": "text",
                            "label": "Patient ID / MRN",
                            "required": True,
                            "placeholder": "Medical Record Number"
                        },
                        {
                            "id": "admission_date",
                            "type": "date",
                            "label": "Date of Admission",
                            "required": True
                        },
                        {
                            "id": "admission_time",
                            "type": "time",
                            "label": "Time of Admission",
                            "required": True
                        },
                        {
                            "id": "date_of_birth",
                            "type": "date",
                            "label": "Date of Birth",
                            "required": True
                        },
                        {
                            "id": "age",
                            "type": "number",
                            "label": "Age",
                            "required": True,
                            "validation": {"min": 0, "max": 120},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "gender",
                            "type": "radio",
                            "label": "Gender",
                            "required": True,
                            "options": ["Male", "Female", "Other"]
                        },
                        {
                            "id": "contact_number",
                            "type": "phone",
                            "label": "Contact Number",
                            "required": True,
                            "config": {"defaultCountryCode": "+91"}
                        },
                        {
                            "id": "emergency_contact_name",
                            "type": "text",
                            "label": "Emergency Contact Name",
                            "required": True,
                            "placeholder": "Name of next of kin"
                        },
                        {
                            "id": "emergency_contact_phone",
                            "type": "phone",
                            "label": "Emergency Contact Phone",
                            "required": True,
                            "config": {"defaultCountryCode": "+91"}
                        },
                        {
                            "id": "admission_type",
                            "type": "select",
                            "label": "Type of Admission",
                            "required": True,
                            "options": [
                                "Emergency",
                                "Planned/Elective",
                                "Urgent",
                                "Day care",
                                "Transfer from another facility"
                            ]
                        },
                        {
                            "id": "admission_source",
                            "type": "select",
                            "label": "Admitted From",
                            "required": True,
                            "options": [
                                "Emergency Department",
                                "OPD",
                                "Direct admission",
                                "Transfer from ICU",
                                "Another hospital",
                                "Home"
                            ]
                        },
                        {
                            "id": "admitting_diagnosis",
                            "type": "textarea",
                            "label": "Admitting Diagnosis",
                            "required": True,
                            "placeholder": "Primary reason for admission...",
                            "validation": {"maxLength": 500}
                        }
                    ]
                },
                {
                    "id": "page_2_clinical_vitals",
                    "title": "Clinical Assessment & Vital Signs",
                    "fields": [
                        {
                            "id": "presenting_complaint",
                            "type": "textarea",
                            "label": "Presenting Complaint & History",
                            "required": True,
                            "placeholder": "Detailed history of presenting illness...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "past_medical_history",
                            "type": "textarea",
                            "label": "Past Medical History",
                            "required": False,
                            "placeholder": "Chronic conditions, previous surgeries, hospitalizations...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "current_medications",
                            "type": "textarea",
                            "label": "Current Medications",
                            "required": False,
                            "placeholder": "List all current medications with dosages...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "allergies",
                            "type": "text",
                            "label": "Known Allergies",
                            "required": True,
                            "placeholder": "Drug, food, or environmental allergies (NKDA if none)"
                        },
                        {
                            "id": "bp_systolic",
                            "type": "number",
                            "label": "Blood Pressure (Systolic)",
                            "placeholder": "e.g., 120",
                            "required": True,
                            "validation": {"min": 60, "max": 250},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "bp_diastolic",
                            "type": "number",
                            "label": "Blood Pressure (Diastolic)",
                            "placeholder": "e.g., 80",
                            "required": True,
                            "validation": {"min": 40, "max": 150},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "heart_rate",
                            "type": "number",
                            "label": "Heart Rate",
                            "placeholder": "e.g., 72",
                            "required": True,
                            "validation": {"min": 30, "max": 200},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "respiratory_rate",
                            "type": "number",
                            "label": "Respiratory Rate",
                            "placeholder": "e.g., 16",
                            "required": True,
                            "validation": {"min": 5, "max": 60},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "temperature",
                            "type": "number",
                            "label": "Temperature (°F)",
                            "placeholder": "e.g., 98.6",
                            "required": True,
                            "validation": {"min": 95, "max": 106},
                            "config": {"allowDecimals": True, "decimalPlaces": 1}
                        },
                        {
                            "id": "spo2",
                            "type": "number",
                            "label": "SpO2 (Oxygen Saturation)",
                            "placeholder": "e.g., 98",
                            "required": True,
                            "validation": {"min": 60, "max": 100},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "weight",
                            "type": "number",
                            "label": "Weight (kg)",
                            "placeholder": "e.g., 70.5",
                            "required": True,
                            "validation": {"min": 20, "max": 300},
                            "config": {"allowDecimals": True, "decimalPlaces": 1}
                        },
                        {
                            "id": "consciousness_level",
                            "type": "select",
                            "label": "Level of Consciousness",
                            "required": True,
                            "options": [
                                "Alert and oriented",
                                "Confused",
                                "Drowsy",
                                "Stuporous",
                                "Unconscious"
                            ]
                        },
                        {
                            "id": "pain_score",
                            "type": "painScale",
                            "label": "Pain Score (0-10)",
                            "required": True,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "scaleSize": 10,
                                "showEmojis": True,
                                "showMainLabels": True
                            }
                        }
                    ]
                },
                {
                    "id": "page_3_risk_plan",
                    "title": "Risk Assessment & Admission Plan",
                    "fields": [
                        {
                            "id": "fall_risk",
                            "type": "radio",
                            "label": "History of Falls (past 6 months)",
                            "required": True,
                            "options": [
                                "No falls",
                                "1 fall",
                                "2-3 falls",
                                "More than 3 falls"
                            ]
                        },
                        {
                            "id": "mobility_status",
                            "type": "severityRating",
                            "label": "Mobility Status",
                            "required": True,
                            "config": {
                                "levels": ["Independent", "Needs assistance", "Bed-bound", "Unable to move"],
                                "scores": [0, 1, 2, 3],
                                "colors": ["#22c55e", "#eab308", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "nutrition_risk",
                            "type": "select",
                            "label": "Nutritional Status",
                            "required": True,
                            "options": [
                                "Well nourished",
                                "At risk",
                                "Malnourished",
                                "Requires assessment"
                            ]
                        },
                        {
                            "id": "pressure_ulcer_risk",
                            "type": "select",
                            "label": "Pressure Ulcer Risk",
                            "required": True,
                            "options": [
                                "Low risk",
                                "Moderate risk",
                                "High risk",
                                "Existing pressure ulcers"
                            ]
                        },
                        {
                            "id": "infection_risk",
                            "type": "checkbox",
                            "label": "Infection Risk Factors",
                            "required": False,
                            "options": [
                                "Immunocompromised",
                                "Recent surgery",
                                "Indwelling devices (catheter, IV)",
                                "Open wounds",
                                "Recent antibiotic use",
                                "None identified"
                            ]
                        },
                        {
                            "id": "isolation_required",
                            "type": "radio",
                            "label": "Isolation Precautions Required?",
                            "required": True,
                            "options": ["Yes", "No"]
                        },
                        {
                            "id": "functional_status",
                            "type": "functionalStatus",
                            "label": "Functional Performance Status (ECOG)",
                            "required": False,
                            "config": {
                                "scale": "ECOG",
                                "showDescriptions": True
                            }
                        },
                        {
                            "id": "initial_orders",
                            "type": "textarea",
                            "label": "Initial Treatment Orders",
                            "required": True,
                            "placeholder": "Medications, IV fluids, oxygen therapy, monitoring requirements...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "investigations_ordered",
                            "type": "checkbox",
                            "label": "Investigations Ordered on Admission",
                            "required": False,
                            "options": [
                                "Complete Blood Count",
                                "Basic Metabolic Panel",
                                "Liver Function Tests",
                                "Urinalysis",
                                "Chest X-ray",
                                "ECG",
                                "Blood cultures",
                                "Other"
                            ]
                        },
                        {
                            "id": "care_plan",
                            "type": "textarea",
                            "label": "Nursing Care Plan & Goals",
                            "required": True,
                            "placeholder": "Immediate care priorities and expected outcomes...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "estimated_los",
                            "type": "select",
                            "label": "Estimated Length of Stay",
                            "required": False,
                            "options": [
                                "1-3 days",
                                "4-7 days",
                                "1-2 weeks",
                                "2-4 weeks",
                                "More than 4 weeks",
                                "Uncertain"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        "name": "Home Care Assessment",
        "description": "Comprehensive home healthcare assessment and care planning form",
        "template_category": "home-care",
        "template_description": "Detailed home care assessment evaluating patient's home environment, safety, self-care abilities, medication management, and caregiver support. Includes care planning and resource coordination.",
        "is_template": True,
        "schema": {
            "pages": [
                {
                    "id": "page_1_patient_home",
                    "title": "Patient Information & Home Environment",
                    "fields": [
                        {
                            "id": "patient_name",
                            "type": "text",
                            "label": "Patient Name",
                            "required": True,
                            "placeholder": "Full name"
                        },
                        {
                            "id": "date_of_birth",
                            "type": "date",
                            "label": "Date of Birth",
                            "required": True
                        },
                        {
                            "id": "age",
                            "type": "number",
                            "label": "Age",
                            "required": True,
                            "validation": {"min": 0, "max": 120},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "gender",
                            "type": "radio",
                            "label": "Gender",
                            "required": True,
                            "options": ["Male", "Female", "Other"]
                        },
                        {
                            "id": "home_address",
                            "type": "textarea",
                            "label": "Home Address",
                            "required": True,
                            "placeholder": "Complete home address...",
                            "validation": {"maxLength": 300}
                        },
                        {
                            "id": "contact_number",
                            "type": "phone",
                            "label": "Contact Number",
                            "required": True,
                            "config": {"defaultCountryCode": "+91"}
                        },
                        {
                            "id": "referral_source",
                            "type": "select",
                            "label": "Referral Source",
                            "required": True,
                            "options": [
                                "Hospital discharge",
                                "Physician",
                                "Family request",
                                "Community health center",
                                "Insurance company",
                                "Self-referred"
                            ]
                        },
                        {
                            "id": "reason_for_home_care",
                            "type": "textarea",
                            "label": "Reason for Home Care Services",
                            "required": True,
                            "placeholder": "Medical condition, post-surgical care, chronic disease management...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "living_situation",
                            "type": "select",
                            "label": "Living Situation",
                            "required": True,
                            "options": [
                                "Lives alone",
                                "Lives with spouse/partner",
                                "Lives with family members",
                                "Lives with paid caregiver",
                                "Shared living arrangement"
                            ]
                        },
                        {
                            "id": "home_type",
                            "type": "select",
                            "label": "Type of Residence",
                            "required": False,
                            "options": [
                                "Single-family house",
                                "Apartment (ground floor)",
                                "Apartment (upper floor with elevator)",
                                "Apartment (upper floor without elevator)",
                                "Assisted living facility",
                                "Other"
                            ]
                        },
                        {
                            "id": "home_safety_concerns",
                            "type": "checkbox",
                            "label": "Home Safety Concerns",
                            "required": True,
                            "options": [
                                "Stairs without railings",
                                "Poor lighting",
                                "Clutter/obstacles",
                                "Slippery floors",
                                "Narrow doorways",
                                "Inaccessible bathroom",
                                "No emergency call system",
                                "None identified"
                            ]
                        },
                        {
                            "id": "bathroom_accessibility",
                            "type": "checkbox",
                            "label": "Bathroom Accessibility Features",
                            "required": False,
                            "options": [
                                "Grab bars",
                                "Raised toilet seat",
                                "Shower chair",
                                "Non-slip mats",
                                "Walk-in shower/tub",
                                "None"
                            ]
                        }
                    ]
                },
                {
                    "id": "page_2_clinical_functional",
                    "title": "Clinical Status & Functional Assessment",
                    "fields": [
                        {
                            "id": "primary_diagnosis",
                            "type": "textarea",
                            "label": "Primary Medical Diagnosis",
                            "required": True,
                            "placeholder": "Main medical condition requiring home care...",
                            "validation": {"maxLength": 300}
                        },
                        {
                            "id": "secondary_diagnoses",
                            "type": "textarea",
                            "label": "Secondary Diagnoses/Comorbidities",
                            "required": False,
                            "placeholder": "Other medical conditions...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "current_medications",
                            "type": "textarea",
                            "label": "Current Medications",
                            "required": True,
                            "placeholder": "List all medications with dosages and frequency...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "medication_management",
                            "type": "select",
                            "label": "Medication Management Ability",
                            "required": True,
                            "options": [
                                "Independent",
                                "Needs reminders",
                                "Needs assistance with setup",
                                "Requires full assistance",
                                "Unable to self-administer"
                            ]
                        },
                        {
                            "id": "bp_systolic",
                            "type": "number",
                            "label": "Blood Pressure (Systolic)",
                            "placeholder": "e.g., 120",
                            "required": False,
                            "validation": {"min": 60, "max": 250},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "bp_diastolic",
                            "type": "number",
                            "label": "Blood Pressure (Diastolic)",
                            "placeholder": "e.g., 80",
                            "required": False,
                            "validation": {"min": 40, "max": 150},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "heart_rate",
                            "type": "number",
                            "label": "Heart Rate",
                            "placeholder": "e.g., 72",
                            "required": False,
                            "validation": {"min": 30, "max": 200},
                            "config": {"allowDecimals": False}
                        },
                        {
                            "id": "weight",
                            "type": "number",
                            "label": "Weight (kg)",
                            "placeholder": "e.g., 70.5",
                            "required": False,
                            "validation": {"min": 20, "max": 300},
                            "config": {"allowDecimals": True, "decimalPlaces": 1}
                        },
                        {
                            "id": "pain_assessment",
                            "type": "painScale",
                            "label": "Current Pain Level (0-10)",
                            "required": False,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "scaleSize": 10,
                                "showEmojis": True,
                                "showMainLabels": True
                            }
                        },
                        {
                            "id": "mobility_status",
                            "type": "severityRating",
                            "label": "Mobility Status",
                            "required": True,
                            "config": {
                                "levels": ["Independent", "Needs aid (cane/walker)", "Needs assistance", "Wheelchair-bound", "Bed-bound"],
                                "scores": [0, 1, 2, 3, 4],
                                "colors": ["#22c55e", "#84cc16", "#eab308", "#f59e0b", "#ef4444"],
                                "layout": "horizontal"
                            }
                        },
                        {
                            "id": "adl_independence",
                            "type": "linearScale",
                            "label": "Activities of Daily Living (ADL) Independence",
                            "required": True,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "minLabel": "Fully Dependent",
                                "maxLabel": "Fully Independent"
                            }
                        },
                        {
                            "id": "adl_assistance_needed",
                            "type": "checkbox",
                            "label": "ADL Assistance Required For",
                            "required": True,
                            "options": [
                                "Bathing",
                                "Dressing",
                                "Eating",
                                "Toileting",
                                "Transfers",
                                "Mobility",
                                "Medication management",
                                "None - Independent"
                            ]
                        },
                        {
                            "id": "cognitive_status",
                            "type": "select",
                            "label": "Cognitive Status",
                            "required": True,
                            "options": [
                                "Alert and oriented",
                                "Mild confusion",
                                "Moderate confusion",
                                "Severe confusion/dementia",
                                "Requires constant supervision"
                            ]
                        },
                        {
                            "id": "fall_history",
                            "type": "radio",
                            "label": "Falls in Past 6 Months",
                            "required": True,
                            "options": [
                                "No falls",
                                "1 fall",
                                "2-3 falls",
                                "More than 3 falls"
                            ]
                        }
                    ]
                },
                {
                    "id": "page_3_caregiver_plan",
                    "title": "Caregiver Support & Care Plan",
                    "fields": [
                        {
                            "id": "primary_caregiver_name",
                            "type": "text",
                            "label": "Primary Caregiver Name",
                            "required": True,
                            "placeholder": "Name of primary support person"
                        },
                        {
                            "id": "caregiver_relationship",
                            "type": "select",
                            "label": "Caregiver Relationship",
                            "required": True,
                            "options": [
                                "Spouse/Partner",
                                "Adult child",
                                "Parent",
                                "Sibling",
                                "Other family member",
                                "Friend",
                                "Professional/paid caregiver",
                                "No caregiver"
                            ]
                        },
                        {
                            "id": "caregiver_contact",
                            "type": "phone",
                            "label": "Caregiver Contact Number",
                            "required": True,
                            "config": {"defaultCountryCode": "+91"}
                        },
                        {
                            "id": "caregiver_availability",
                            "type": "select",
                            "label": "Caregiver Availability",
                            "required": True,
                            "options": [
                                "24/7 availability",
                                "Daytime only",
                                "Evening/night only",
                                "Weekdays only",
                                "Weekends only",
                                "Limited availability",
                                "Not available"
                            ]
                        },
                        {
                            "id": "caregiver_stress",
                            "type": "linearScale",
                            "label": "Caregiver Stress Level",
                            "required": False,
                            "config": {
                                "min": 0,
                                "max": 10,
                                "minLabel": "No Stress",
                                "maxLabel": "Extreme Stress"
                            }
                        },
                        {
                            "id": "support_services_needed",
                            "type": "checkbox",
                            "label": "Support Services Needed",
                            "required": True,
                            "options": [
                                "Nursing care",
                                "Physical therapy",
                                "Occupational therapy",
                                "Speech therapy",
                                "Wound care",
                                "Medication management",
                                "Personal care assistance",
                                "Medical equipment",
                                "Meal preparation",
                                "Transportation",
                                "Respite care",
                                "Social work services"
                            ]
                        },
                        {
                            "id": "equipment_needed",
                            "type": "checkbox",
                            "label": "Medical Equipment Required",
                            "required": False,
                            "options": [
                                "Hospital bed",
                                "Wheelchair",
                                "Walker",
                                "Commode",
                                "Oxygen",
                                "Nebulizer",
                                "Blood pressure monitor",
                                "Glucose monitor",
                                "Other DME",
                                "None"
                            ]
                        },
                        {
                            "id": "visit_frequency",
                            "type": "select",
                            "label": "Recommended Visit Frequency",
                            "required": True,
                            "options": [
                                "Daily",
                                "3x per week",
                                "2x per week",
                                "Weekly",
                                "Bi-weekly",
                                "As needed"
                            ]
                        },
                        {
                            "id": "care_goals",
                            "type": "textarea",
                            "label": "Short-term Care Goals (1-3 months)",
                            "required": True,
                            "placeholder": "Specific, measurable goals for patient care...",
                            "validation": {"maxLength": 500}
                        },
                        {
                            "id": "care_plan_interventions",
                            "type": "textarea",
                            "label": "Care Plan Interventions",
                            "required": True,
                            "placeholder": "Specific nursing interventions, therapies, education needs...",
                            "validation": {"maxLength": 1000}
                        },
                        {
                            "id": "emergency_plan",
                            "type": "textarea",
                            "label": "Emergency Contact Plan",
                            "required": True,
                            "placeholder": "What to do in case of emergency, who to contact...",
                            "validation": {"maxLength": 300}
                        },
                        {
                            "id": "insurance_coverage",
                            "type": "radio",
                            "label": "Insurance/Payment Coverage Verified?",
                            "required": True,
                            "options": ["Yes", "No", "Pending"]
                        }
                    ]
                }
            ]
        }
    }
]


def seed_form_templates():
    """Seed the database with healthcare form templates."""
    app = create_app()

    with app.app_context():
        print("Starting healthcare form templates seeding...")

        # Check if templates already exist
        existing_count = Form.query.filter_by(is_template=True).count()
        if existing_count > 0:
            print(f"Found {existing_count} existing templates.")
            response = input("Delete existing templates and re-seed? (yes/no): ")
            if response.lower() != 'yes':
                print("Seeding cancelled.")
                return

            # Delete existing templates
            Form.query.filter_by(is_template=True).delete()
            db.session.commit()
            print("Existing templates deleted.")

        # Create form templates
        created_count = 0
        for template_data in FORM_TEMPLATES:
            form = Form(
                name=template_data["name"],
                description=template_data["description"],
                schema=template_data["schema"],
                is_template=template_data["is_template"],
                template_category=template_data["template_category"],
                template_description=template_data["template_description"],
                created_by=None,  # System-created, no user
                is_active=True
            )

            # Validate schema
            is_valid, message = form.validate_schema()
            if not is_valid:
                print(f"ERROR: Invalid template '{form.name}': {message}")
                continue

            db.session.add(form)
            created_count += 1

            # Count total fields
            total_fields = 0
            if 'pages' in template_data['schema']:
                for page in template_data['schema']['pages']:
                    total_fields += len(page.get('fields', []))
            else:
                total_fields = len(template_data['schema'].get('fields', []))

            pages_count = len(template_data['schema'].get('pages', [])) or 1
            print(f"Created template: {form.name} ({pages_count} pages, {total_fields} fields)")

        # Commit all changes
        db.session.commit()
        print(f"\n✅ Successfully seeded {created_count} healthcare form templates!")

        # Display summary
        print("\nForm Templates Summary:")
        print("-" * 80)
        templates = Form.query.filter_by(is_template=True).all()
        for template in templates:
            page_count = len(template.schema.get('pages', [])) or 1
            total_fields = 0
            if 'pages' in template.schema:
                for page in template.schema['pages']:
                    total_fields += len(page.get('fields', []))
            else:
                total_fields = len(template.schema.get('fields', []))

            print(f"  • {template.name} ({template.template_category})")
            print(f"    └─ {page_count} pages, {total_fields} fields")
        print("-" * 80)


if __name__ == "__main__":
    seed_form_templates()
