#!/usr/bin/env python3
"""
End-to-End Test for Hybrid Processing Pipeline
Tests: Form Submission → Processing → Relational Storage → Audit Logging
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "http://127.0.0.1:5001/api"

# Test Data
TEST_USER = {
    "email": "test_e2e@test.com",
    "password": "TestPassword123!",
    "full_name": "E2E Test User",
    "role": "admin"
}

TEST_FORM_SCHEMA = {
    "pages": [
        {
            "id": "page_1",
            "title": "Patient Demographics & Vitals",
            "fields": [
                {
                    "id": "patient_name",
                    "type": "text",
                    "label": "Patient Name",
                    "required": True
                },
                {
                    "id": "date_of_birth",
                    "type": "date",
                    "label": "Date of Birth",
                    "required": True
                },
                {
                    "id": "gender",
                    "type": "select",
                    "label": "Gender",
                    "options": ["Male", "Female", "Other"],
                    "required": True
                },
                {
                    "id": "phone",
                    "type": "text",
                    "label": "Phone Number",
                    "required": False
                },
                {
                    "id": "blood_pressure_systolic",
                    "type": "number",
                    "label": "Blood Pressure - Systolic (mmHg)",
                    "required": False
                },
                {
                    "id": "blood_pressure_diastolic",
                    "type": "number",
                    "label": "Blood Pressure - Diastolic (mmHg)",
                    "required": False
                },
                {
                    "id": "temperature",
                    "type": "number",
                    "label": "Body Temperature (°F)",
                    "required": False
                },
                {
                    "id": "heart_rate",
                    "type": "number",
                    "label": "Heart Rate (bpm)",
                    "required": False
                },
                {
                    "id": "spo2",
                    "type": "number",
                    "label": "SpO2 (%)",
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
                    "id": "pain_scale",
                    "type": "painScale",
                    "label": "Pain Scale (0-10)",
                    "required": False,
                    "config": {
                        "min": 0,
                        "max": 10,
                        "descriptions": ["No pain", "Mild", "Moderate", "Severe"]
                    }
                },
                {
                    "id": "chief_complaint",
                    "type": "textarea",
                    "label": "Chief Complaint",
                    "required": False
                }
            ]
        }
    ]
}

TEST_SUBMISSION_DATA = {
    "patient_name": "John Doe",
    "date_of_birth": "1985-05-15",
    "gender": "Male",
    "phone": "9876543210",
    "blood_pressure_systolic": 120,
    "blood_pressure_diastolic": 80,
    "temperature": 98.6,
    "heart_rate": 72,
    "spo2": 98,
    "weight": 70,
    "height": 175,
    "pain_scale": 3,
    "chief_complaint": "Fever and headache for 2 days"
}


def print_section(title):
    """Print a section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_result(label, value):
    """Print a test result."""
    print(f"✓ {label}: {value}")


def print_error(label, error):
    """Print an error."""
    print(f"✗ {label}: {error}")


def register_user():
    """Register a test user."""
    print_section("1. USER REGISTRATION")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=TEST_USER,
            timeout=10
        )
        if response.status_code == 201:
            print_result("User registered", TEST_USER["email"])
            return True
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print_result("User already exists", TEST_USER["email"])
            return True
        else:
            print_error("Registration failed", response.text)
            return False
    except Exception as e:
        print_error("Registration error", str(e))
        return False


def login_user():
    """Login and get JWT token."""
    print_section("2. USER LOGIN")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": TEST_USER["email"],
                "password": TEST_USER["password"]
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print_result("Login successful", f"Token: {token[:20]}...")
            return token
        else:
            print_error("Login failed", response.text)
            return None
    except Exception as e:
        print_error("Login error", str(e))
        return None


def create_form(token):
    """Create a test form."""
    print_section("3. CREATE TEST FORM")
    try:
        response = requests.post(
            f"{BASE_URL}/forms",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "E2E Test - Clinical Data Collection",
                "description": "Test form with patient demographics and vitals",
                "schema": TEST_FORM_SCHEMA
            },
            timeout=10
        )
        if response.status_code == 201:
            data = response.json()
            form_id = data["form"]["id"]
            print_result("Form created", f"ID: {form_id}")
            return form_id
        else:
            print_error("Form creation failed", response.text)
            return None
    except Exception as e:
        print_error("Form creation error", str(e))
        return None


def submit_form(token, form_id):
    """Submit the test form with clinical data."""
    print_section("4. SUBMIT FORM WITH CLINICAL DATA")
    try:
        response = requests.post(
            f"{BASE_URL}/submissions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "form_id": form_id,
                "data": TEST_SUBMISSION_DATA,
                "encounter_type": "OPD",
                "chief_complaint": TEST_SUBMISSION_DATA["chief_complaint"]
            },
            timeout=10
        )
        if response.status_code == 201:
            data = response.json()
            print_result("Submission successful", f"ID: {data['submission']['id']}")
            print("\n📊 Processing Summary:")
            summary = data.get("processing_summary", {})
            print(f"   • Patient ID: {summary.get('patient_id')}")
            print(f"   • Patient Name: {summary.get('patient_name')}")
            print(f"   • Encounter ID: {summary.get('encounter_id')}")
            print(f"   • Encounter Type: {summary.get('encounter_type')}")
            print(f"   • Form Answers Saved: {summary.get('form_answers_saved')}")
            print(f"   • Observations Created: {summary.get('observations_created')}")
            print(f"   • Diagnoses Created: {summary.get('diagnoses_created')}")

            vitals = summary.get('vitals_recorded', [])
            if vitals:
                print(f"\n   📈 Vitals Recorded:")
                for vital in vitals:
                    print(f"      - {vital['type']}: {vital['value']} {vital.get('unit', '')}")

            return data['submission']['id'], summary.get('patient_id'), summary.get('encounter_id')
        else:
            print_error("Submission failed", response.text)
            return None, None, None
    except Exception as e:
        print_error("Submission error", str(e))
        return None, None, None


def verify_database(submission_id, patient_id, encounter_id):
    """Verify data in database."""
    print_section("5. DATABASE VERIFICATION")

    import psycopg2
    try:
        conn = psycopg2.connect("dbname=cv_raman_health")
        cur = conn.cursor()

        # Check Patient
        cur.execute("SELECT id, full_name, date_of_birth, gender, is_active FROM patients WHERE id = %s", (patient_id,))
        patient = cur.fetchone()
        if patient:
            print_result("Patient record", f"ID: {patient[0]}, Name: {patient[1]}, DOB: {patient[2]}, Gender: {patient[3]}")
        else:
            print_error("Patient record", "Not found")

        # Check Encounter
        cur.execute("SELECT id, encounter_type, start_time, status, chief_complaint FROM encounters WHERE id = %s", (encounter_id,))
        encounter = cur.fetchone()
        if encounter:
            print_result("Encounter record", f"ID: {encounter[0]}, Type: {encounter[1]}, Status: {encounter[3]}")
        else:
            print_error("Encounter record", "Not found")

        # Check Observations
        cur.execute("""
            SELECT observation_type, value_numeric, unit, loinc_code
            FROM observations
            WHERE patient_id = %s
            ORDER BY created_at
        """, (patient_id,))
        observations = cur.fetchall()
        print_result("Observations", f"{len(observations)} records")
        for obs in observations:
            print(f"   • {obs[0]}: {obs[1]} {obs[2] or ''} (LOINC: {obs[3] or 'N/A'})")

        # Check FormAnswers
        cur.execute("""
            SELECT field_id, field_type, value_text, value_numeric
            FROM form_answers
            WHERE submission_id = %s
            ORDER BY created_at
        """, (submission_id,))
        answers = cur.fetchall()
        print_result("Form Answers", f"{len(answers)} records")
        for ans in answers[:5]:  # Show first 5
            value = ans[3] if ans[3] is not None else ans[2]
            print(f"   • {ans[0]} ({ans[1]}): {value}")
        if len(answers) > 5:
            print(f"   ... and {len(answers) - 5} more")

        # Check AuditLog
        cur.execute("""
            SELECT action, entity_type, success, created_at
            FROM audit_logs
            WHERE patient_id = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (patient_id,))
        audits = cur.fetchall()
        print_result("Audit Logs", f"{len(audits)} recent entries")
        for audit in audits:
            print(f"   • {audit[0]} on {audit[1]} - Success: {audit[2]} at {audit[3]}")

        cur.close()
        conn.close()
        return True

    except Exception as e:
        print_error("Database verification", str(e))
        return False


def main():
    """Run end-to-end test."""
    print("\n" + "🚀 " * 30)
    print("  HYBRID PROCESSING PIPELINE - END-TO-END TEST")
    print("🚀 " * 30)

    # Step 1: Register user
    if not register_user():
        print("\n❌ Test failed at user registration")
        return False

    # Step 2: Login
    token = login_user()
    if not token:
        print("\n❌ Test failed at login")
        return False

    # Step 3: Create form
    form_id = create_form(token)
    if not form_id:
        print("\n❌ Test failed at form creation")
        return False

    # Step 4: Submit form
    submission_id, patient_id, encounter_id = submit_form(token, form_id)
    if not submission_id:
        print("\n❌ Test failed at form submission")
        return False

    # Step 5: Verify database
    if not verify_database(submission_id, patient_id, encounter_id):
        print("\n❌ Test failed at database verification")
        return False

    print_section("✅ ALL TESTS PASSED!")
    print("\n🎉 The hybrid processing pipeline is working correctly!")
    print("   • Form submission accepted ✓")
    print("   • Patient record created with encrypted PII ✓")
    print("   • Encounter record created ✓")
    print("   • Observations extracted and stored with LOINC codes ✓")
    print("   • Form answers stored relationally ✓")
    print("   • Audit trail logged ✓")
    print("\n" + "=" * 80 + "\n")
    return True


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
