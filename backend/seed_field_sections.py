"""
Seed script for pre-defined field sections.
Run this script to populate the database with healthcare field section templates.

Usage:
    python seed_field_sections.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.risk.models import FieldSection

# Pre-defined field sections
FIELD_SECTIONS = [
    {
        "name": "Vital Signs",
        "description": "Standard vital signs measurements",
        "category": "vitals",
        "is_system": True,
        "fields": [
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
                "id": "respiratory_rate",
                "type": "number",
                "label": "Respiratory Rate",
                "placeholder": "e.g., 16",
                "required": True,
                "validation": {"min": 5, "max": 60},
                "config": {"allowDecimals": False},
                "clinicalMapping": {
                    "observationType": "respiratory_rate",
                    "loincCode": "9279-1",
                    "unit": "/min",
                    "category": "vital-signs"
                }
            },
            {
                "id": "temperature",
                "type": "number",
                "label": "Temperature",
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
                "label": "Weight",
                "placeholder": "e.g., 70.5",
                "required": False,
                "validation": {"min": 20, "max": 300},
                "config": {"allowDecimals": True, "decimalPlaces": 1},
                "clinicalMapping": {
                    "observationType": "weight",
                    "loincCode": "29463-7",
                    "unit": "kg",
                    "category": "vital-signs"
                }
            }
        ]
    },
    {
        "name": "Pain Assessment",
        "description": "Comprehensive pain evaluation",
        "category": "assessment",
        "is_system": True,
        "fields": [
            {
                "id": "pain_location",
                "type": "select",
                "label": "Pain Location",
                "required": True,
                "options": [
                    "Head/Neck",
                    "Chest",
                    "Back (Upper)",
                    "Back (Lower)",
                    "Abdomen",
                    "Shoulder (Left)",
                    "Shoulder (Right)",
                    "Arm (Left)",
                    "Arm (Right)",
                    "Hip (Left)",
                    "Hip (Right)",
                    "Leg (Left)",
                    "Leg (Right)",
                    "Multiple Locations"
                ]
            },
            {
                "id": "pain_intensity",
                "type": "painScale",
                "label": "Pain Intensity (0-10)",
                "required": True,
                "config": {
                    "min": 0,
                    "max": 10,
                    "scaleSize": 10,
                    "showEmojis": False,
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
                "id": "pain_character",
                "type": "checkbox",
                "label": "Pain Character (select all that apply)",
                "required": False,
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
                "id": "pain_duration",
                "type": "select",
                "label": "Pain Duration",
                "required": True,
                "options": [
                    "Less than 1 week",
                    "1-4 weeks",
                    "1-3 months",
                    "3-6 months",
                    "More than 6 months"
                ]
            },
            {
                "id": "pain_triggers",
                "type": "textarea",
                "label": "What triggers or worsens the pain?",
                "placeholder": "e.g., Movement, sitting, standing, lying down...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Functional Status",
        "description": "Activities of daily living and mobility assessment",
        "category": "assessment",
        "is_system": True,
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
                "id": "mobility_aids",
                "type": "checkbox",
                "label": "Mobility Aids Used",
                "required": False,
                "options": [
                    "Cane",
                    "Walker",
                    "Wheelchair",
                    "Crutches",
                    "Prosthetic",
                    "None"
                ]
            }
        ]
    },
    {
        "name": "Mental Health Screening",
        "description": "Basic mental health and mood assessment",
        "category": "assessment",
        "is_system": True,
        "fields": [
            {
                "id": "mood",
                "type": "select",
                "label": "Current Mood",
                "required": True,
                "options": [
                    "Good",
                    "Fair",
                    "Low/Depressed",
                    "Anxious",
                    "Irritable",
                    "Confused"
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
                "id": "cognitive_function",
                "type": "select",
                "label": "Cognitive Function",
                "required": False,
                "options": [
                    "Alert and oriented",
                    "Mild confusion",
                    "Moderate confusion",
                    "Severe confusion",
                    "Unresponsive"
                ]
            },
            {
                "id": "social_engagement",
                "type": "select",
                "label": "Social Engagement",
                "required": False,
                "options": [
                    "Very social",
                    "Moderately social",
                    "Prefers solitude",
                    "Isolated",
                    "Withdrawn"
                ]
            },
            {
                "id": "caregiver_stress",
                "type": "linearScale",
                "label": "Caregiver Stress Level (if applicable)",
                "required": False,
                "config": {
                    "min": 0,
                    "max": 10,
                    "minLabel": "No Stress",
                    "maxLabel": "Extreme Stress"
                }
            }
        ]
    },
    {
        "name": "Social Support Assessment",
        "description": "Living situation and support network evaluation",
        "category": "social",
        "is_system": True,
        "fields": [
            {
                "id": "living_situation",
                "type": "select",
                "label": "Living Situation",
                "required": True,
                "options": [
                    "Lives alone",
                    "Lives with spouse/partner",
                    "Lives with family members",
                    "Lives with caregiver",
                    "Assisted living facility",
                    "Nursing home"
                ]
            },
            {
                "id": "primary_caregiver",
                "type": "text",
                "label": "Primary Caregiver Name (if applicable)",
                "placeholder": "Name of primary caregiver",
                "required": False,
                "validation": {"maxLength": 100}
            },
            {
                "id": "support_network",
                "type": "checkbox",
                "label": "Available Support",
                "required": False,
                "options": [
                    "Family nearby",
                    "Friends/neighbors",
                    "Community services",
                    "Religious/spiritual support",
                    "Professional caregivers",
                    "Limited/no support"
                ]
            },
            {
                "id": "financial_concerns",
                "type": "radio",
                "label": "Financial Concerns Related to Healthcare",
                "required": False,
                "options": [
                    "No concerns",
                    "Some concerns",
                    "Major concerns",
                    "Prefer not to say"
                ]
            }
        ]
    },
    {
        "name": "Geriatric Patient Screening",
        "description": "Comprehensive screening for elderly patients (GPC)",
        "category": "assessment",
        "is_system": True,
        "fields": [
            {
                "id": "age",
                "type": "number",
                "label": "Age",
                "required": True,
                "validation": {"min": 60, "max": 120},
                "config": {"allowDecimals": False}
            },
            {
                "id": "symptoms_checklist",
                "type": "symptomChecklist",
                "label": "Current Symptoms",
                "required": True,
                "config": {
                    "symptoms": ["Pain", "Weakness", "Fatigue", "Dizziness", "Nausea", "Shortness of Breath"],
                    "severityLevels": ["Mild", "Moderate", "Severe"],
                    "allowMultiple": True,
                    "showSeverity": True
                }
            },
            {
                "id": "fall_history",
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
                "id": "comorbidities_count",
                "type": "number",
                "label": "Number of Chronic Conditions",
                "placeholder": "e.g., 3",
                "required": True,
                "validation": {"min": 0, "max": 20},
                "config": {"allowDecimals": False}
            },
            {
                "id": "functional_status",
                "type": "functionalStatus",
                "label": "Functional Performance Status",
                "required": True,
                "config": {
                    "scale": "ECOG",
                    "showDescriptions": True
                }
            }
        ]
    },
    # PHYSIOTHERAPY SECTIONS
    {
        "name": "Anthropometric Measurements",
        "description": "Body measurements and composition",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "height",
                "type": "number",
                "label": "Height (cm)",
                "placeholder": "e.g., 170",
                "required": True,
                "validation": {"min": 50, "max": 250},
                "config": {"allowDecimals": True, "decimalPlaces": 1},
                "clinicalMapping": {
                    "observationType": "height",
                    "loincCode": "8302-2",
                    "unit": "cm",
                    "category": "vital-signs"
                }
            },
            {
                "id": "weight_physio",
                "type": "number",
                "label": "Weight (kg)",
                "placeholder": "e.g., 70.5",
                "required": True,
                "validation": {"min": 20, "max": 300},
                "config": {"allowDecimals": True, "decimalPlaces": 1},
                "clinicalMapping": {
                    "observationType": "weight",
                    "loincCode": "29463-7",
                    "unit": "kg",
                    "category": "vital-signs"
                }
            },
            {
                "id": "bmi",
                "type": "number",
                "label": "BMI (Body Mass Index)",
                "placeholder": "Auto-calculated or manual entry",
                "required": False,
                "validation": {"min": 10, "max": 60},
                "config": {
                    "allowDecimals": True,
                    "decimalPlaces": 1,
                    "isCalculated": True,
                    "calculationFormula": "weight_physio / ((height / 100) ** 2)",
                    "allowOverride": True,
                    "dependsOn": ["height", "weight_physio"]
                },
                "clinicalMapping": {
                    "observationType": "bmi",
                    "loincCode": "39156-5",
                    "unit": "kg/m2",
                    "category": "vital-signs"
                }
            },
            {
                "id": "body_fat_percentage",
                "type": "number",
                "label": "Body Fat Percentage (%)",
                "placeholder": "e.g., 22.5",
                "required": False,
                "validation": {"min": 1, "max": 60},
                "config": {"allowDecimals": True, "decimalPlaces": 1}
            },
            {
                "id": "anthropometric_notes",
                "type": "textarea",
                "label": "Notes",
                "placeholder": "Additional observations...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Range of Motion Assessment",
        "description": "Joint mobility and flexibility measurement",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "rom_joint",
                "type": "select",
                "label": "Joint",
                "required": True,
                "options": [
                    "Shoulder",
                    "Elbow",
                    "Wrist",
                    "Hip",
                    "Knee",
                    "Ankle",
                    "Cervical Spine",
                    "Thoracic Spine",
                    "Lumbar Spine"
                ]
            },
            {
                "id": "rom_side",
                "type": "select",
                "label": "Side",
                "required": True,
                "options": ["Left", "Right", "Bilateral"]
            },
            {
                "id": "rom_movement",
                "type": "select",
                "label": "Movement Type",
                "required": True,
                "options": [
                    "Flexion",
                    "Extension",
                    "Abduction",
                    "Adduction",
                    "Internal Rotation",
                    "External Rotation",
                    "Lateral Flexion",
                    "Rotation"
                ]
            },
            {
                "id": "rom_degrees",
                "type": "number",
                "label": "Degrees Achieved",
                "placeholder": "e.g., 140",
                "required": True,
                "validation": {"min": 0, "max": 360},
                "config": {"allowDecimals": False}
            },
            {
                "id": "rom_normal",
                "type": "number",
                "label": "Normal Range (degrees)",
                "placeholder": "e.g., 180",
                "required": False,
                "validation": {"min": 0, "max": 360},
                "config": {"allowDecimals": False}
            },
            {
                "id": "rom_pain",
                "type": "painScale",
                "label": "Pain During Movement (0-10)",
                "required": False,
                "config": {
                    "min": 0,
                    "max": 10,
                    "scaleSize": 10,
                    "showEmojis": False,
                    "showMainLabels": True
                }
            },
            {
                "id": "rom_notes",
                "type": "textarea",
                "label": "ROM Notes",
                "placeholder": "Observations, limitations, end feel...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Muscle Strength Testing",
        "description": "Manual muscle testing (MMT) assessment",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "muscle_group",
                "type": "select",
                "label": "Muscle Group",
                "required": True,
                "options": [
                    "Deltoid",
                    "Biceps",
                    "Triceps",
                    "Wrist Flexors",
                    "Wrist Extensors",
                    "Hip Flexors",
                    "Hip Extensors",
                    "Hip Abductors",
                    "Hip Adductors",
                    "Quadriceps",
                    "Hamstrings",
                    "Tibialis Anterior",
                    "Gastrocnemius/Soleus",
                    "Core/Abdominals",
                    "Back Extensors"
                ]
            },
            {
                "id": "muscle_side",
                "type": "select",
                "label": "Side",
                "required": True,
                "options": ["Left", "Right", "Bilateral"]
            },
            {
                "id": "strength_grade",
                "type": "select",
                "label": "Strength Grade (MMT Scale)",
                "required": True,
                "options": [
                    "0 - No contraction",
                    "1 - Trace/flicker of movement",
                    "2 - Poor (movement with gravity eliminated)",
                    "3 - Fair (movement against gravity)",
                    "4 - Good (movement against some resistance)",
                    "5 - Normal (movement against full resistance)"
                ]
            },
            {
                "id": "resistance_applied",
                "type": "text",
                "label": "Resistance Applied",
                "placeholder": "e.g., Moderate manual resistance",
                "required": False,
                "validation": {"maxLength": 200}
            },
            {
                "id": "strength_notes",
                "type": "textarea",
                "label": "Notes",
                "placeholder": "Observations, compensations, pain...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Gait & Balance Assessment",
        "description": "Walking pattern and balance evaluation",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "gait_pattern",
                "type": "select",
                "label": "Gait Pattern",
                "required": True,
                "options": [
                    "Normal",
                    "Antalgic (pain-avoiding)",
                    "Ataxic (uncoordinated)",
                    "Hemiplegic (one-sided weakness)",
                    "Parkinsonian (shuffling)",
                    "Trendelenburg (hip weakness)",
                    "Steppage (foot drop)",
                    "Waddling"
                ]
            },
            {
                "id": "walking_aid",
                "type": "select",
                "label": "Walking Aid",
                "required": True,
                "options": [
                    "None",
                    "Cane (single point)",
                    "Cane (quad)",
                    "Walker (standard)",
                    "Walker (rolling)",
                    "Crutches (axillary)",
                    "Crutches (forearm)",
                    "Wheelchair",
                    "Prosthetic device"
                ]
            },
            {
                "id": "walk_distance",
                "type": "number",
                "label": "Distance Walked (meters)",
                "placeholder": "e.g., 50",
                "required": False,
                "validation": {"min": 0, "max": 1000},
                "config": {"allowDecimals": True, "decimalPlaces": 1}
            },
            {
                "id": "walk_time",
                "type": "number",
                "label": "Time Taken (seconds)",
                "placeholder": "e.g., 45",
                "required": False,
                "validation": {"min": 0, "max": 3600},
                "config": {"allowDecimals": True, "decimalPlaces": 1}
            },
            {
                "id": "walk_speed",
                "type": "number",
                "label": "Walking Speed (m/s)",
                "placeholder": "Auto-calculated or manual entry",
                "required": False,
                "validation": {"min": 0, "max": 10},
                "config": {
                    "allowDecimals": True,
                    "decimalPlaces": 2,
                    "isCalculated": True,
                    "calculationFormula": "walk_distance / walk_time",
                    "allowOverride": True,
                    "dependsOn": ["walk_distance", "walk_time"]
                }
            },
            {
                "id": "balance_test",
                "type": "select",
                "label": "Balance Test Type",
                "required": False,
                "options": [
                    "Berg Balance Scale",
                    "Timed Up & Go (TUG)",
                    "Single Leg Stance",
                    "Romberg Test",
                    "Functional Reach Test",
                    "Tinetti Balance Assessment"
                ]
            },
            {
                "id": "balance_score",
                "type": "number",
                "label": "Balance Test Score",
                "placeholder": "Score based on test type",
                "required": False,
                "validation": {"min": 0, "max": 100},
                "config": {"allowDecimals": True, "decimalPlaces": 1}
            },
            {
                "id": "falls_risk",
                "type": "select",
                "label": "Falls Risk Level",
                "required": False,
                "options": ["Low", "Moderate", "High"]
            },
            {
                "id": "gait_balance_notes",
                "type": "textarea",
                "label": "Notes",
                "placeholder": "Observations about gait, balance, safety concerns...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Posture Assessment",
        "description": "Static and dynamic posture evaluation",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "head_position",
                "type": "select",
                "label": "Head Position",
                "required": True,
                "options": [
                    "Neutral/Normal",
                    "Forward head posture",
                    "Lateral tilt (left)",
                    "Lateral tilt (right)",
                    "Rotated (left)",
                    "Rotated (right)"
                ]
            },
            {
                "id": "shoulder_position",
                "type": "select",
                "label": "Shoulder Position",
                "required": True,
                "options": [
                    "Neutral/Level",
                    "Rounded/Protracted",
                    "Retracted",
                    "Elevated (both)",
                    "Left elevated",
                    "Right elevated",
                    "Asymmetrical"
                ]
            },
            {
                "id": "spine_alignment",
                "type": "select",
                "label": "Spine Alignment",
                "required": True,
                "options": [
                    "Neutral/Normal curves",
                    "Increased thoracic kyphosis",
                    "Increased lumbar lordosis",
                    "Decreased lumbar lordosis",
                    "Scoliosis (lateral curve)",
                    "Flat back"
                ]
            },
            {
                "id": "pelvic_position",
                "type": "select",
                "label": "Pelvic Position",
                "required": True,
                "options": [
                    "Neutral",
                    "Anterior tilt",
                    "Posterior tilt",
                    "Lateral tilt (left high)",
                    "Lateral tilt (right high)",
                    "Rotated"
                ]
            },
            {
                "id": "posture_notes",
                "type": "textarea",
                "label": "Posture Notes",
                "placeholder": "Detailed observations, compensations, functional impact...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Special Orthopaedic Tests",
        "description": "Clinical special tests for specific conditions",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "ortho_test",
                "type": "select",
                "label": "Test Name",
                "required": True,
                "options": [
                    "Neer's Test (shoulder impingement)",
                    "Hawkins-Kennedy Test (shoulder impingement)",
                    "Empty Can Test (supraspinatus)",
                    "Apprehension Test (shoulder instability)",
                    "Speed's Test (biceps tendinitis)",
                    "Lachman Test (ACL)",
                    "Anterior Drawer Test (ACL)",
                    "McMurray Test (meniscus)",
                    "Valgus Stress Test (MCL)",
                    "Varus Stress Test (LCL)",
                    "Thomas Test (hip flexor tightness)",
                    "Ober Test (IT band tightness)",
                    "Straight Leg Raise (SLR - sciatic nerve)",
                    "Slump Test (neural tension)",
                    "Patrick's Test/FABER (hip pathology)",
                    "Trendelenburg Test (hip abductor weakness)"
                ]
            },
            {
                "id": "test_side",
                "type": "select",
                "label": "Side Tested",
                "required": True,
                "options": ["Left", "Right", "Bilateral"]
            },
            {
                "id": "test_result",
                "type": "select",
                "label": "Test Result",
                "required": True,
                "options": ["Positive", "Negative", "Inconclusive"]
            },
            {
                "id": "test_notes",
                "type": "textarea",
                "label": "Test Notes",
                "placeholder": "Findings, patient response, pain reproduction...",
                "required": False,
                "validation": {"maxLength": 500}
            }
        ]
    },
    {
        "name": "Exercise Prescription",
        "description": "Therapeutic exercise program details",
        "category": "physiotherapy",
        "is_system": True,
        "fields": [
            {
                "id": "exercise_name",
                "type": "text",
                "label": "Exercise Name",
                "placeholder": "e.g., Shoulder External Rotation",
                "required": True,
                "validation": {"maxLength": 200}
            },
            {
                "id": "exercise_sets",
                "type": "number",
                "label": "Sets",
                "placeholder": "e.g., 3",
                "required": True,
                "validation": {"min": 1, "max": 20},
                "config": {"allowDecimals": False}
            },
            {
                "id": "exercise_reps",
                "type": "number",
                "label": "Repetitions per Set",
                "placeholder": "e.g., 10",
                "required": True,
                "validation": {"min": 1, "max": 100},
                "config": {"allowDecimals": False}
            },
            {
                "id": "hold_duration",
                "type": "number",
                "label": "Hold Duration (seconds)",
                "placeholder": "e.g., 5",
                "required": False,
                "validation": {"min": 0, "max": 300},
                "config": {"allowDecimals": False}
            },
            {
                "id": "exercise_frequency",
                "type": "number",
                "label": "Frequency (times per week)",
                "placeholder": "e.g., 5",
                "required": True,
                "validation": {"min": 1, "max": 7},
                "config": {"allowDecimals": False}
            },
            {
                "id": "total_weekly_reps",
                "type": "number",
                "label": "Total Weekly Repetitions",
                "placeholder": "Auto-calculated or manual entry",
                "required": False,
                "validation": {"min": 0, "max": 10000},
                "config": {
                    "allowDecimals": False,
                    "isCalculated": True,
                    "calculationFormula": "exercise_sets * exercise_reps * exercise_frequency",
                    "allowOverride": True,
                    "dependsOn": ["exercise_sets", "exercise_reps", "exercise_frequency"]
                }
            },
            {
                "id": "exercise_instructions",
                "type": "textarea",
                "label": "Instructions & Precautions",
                "placeholder": "Detailed instructions, form cues, precautions...",
                "required": False,
                "validation": {"maxLength": 1000}
            }
        ]
    }
]


def seed_field_sections():
    """Seed the database with pre-defined field sections."""
    app = create_app()

    with app.app_context():
        print("Starting field section seeding...")

        # Check if sections already exist
        existing_count = FieldSection.query.filter_by(is_system=True).count()
        if existing_count > 0:
            print(f"Found {existing_count} existing system sections.")
            response = input("Delete existing system sections and re-seed? (yes/no): ")
            if response.lower() != 'yes':
                print("Seeding cancelled.")
                return

            # Delete existing system sections
            FieldSection.query.filter_by(is_system=True).delete()
            db.session.commit()
            print("Existing system sections deleted.")

        # Create field sections
        created_count = 0
        for section_data in FIELD_SECTIONS:
            section = FieldSection(
                name=section_data["name"],
                description=section_data["description"],
                category=section_data["category"],
                fields=section_data["fields"],
                is_system=section_data["is_system"],
                created_by=None  # System-created, no user
            )

            # Validate fields structure
            is_valid, message = section.validate_fields()
            if not is_valid:
                print(f"ERROR: Invalid section '{section.name}': {message}")
                continue

            db.session.add(section)
            created_count += 1
            print(f"Created section: {section.name} ({len(section_data['fields'])} fields)")

        # Commit all changes
        db.session.commit()
        print(f"\n✅ Successfully seeded {created_count} field sections!")

        # Display summary
        print("\nField Sections Summary:")
        print("-" * 60)
        sections = FieldSection.query.filter_by(is_system=True).all()
        for section in sections:
            print(f"  • {section.name} ({section.category}) - {len(section.fields)} fields")
        print("-" * 60)


if __name__ == "__main__":
    seed_field_sections()
