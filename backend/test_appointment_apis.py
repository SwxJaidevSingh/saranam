#!/usr/bin/env python3
"""
Comprehensive API Test Script for Appointment Management System
Tests all provider, schedule, and appointment endpoints
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "http://127.0.0.1:5002/api"
TEST_USER = {
    "email": "test@example.com",
    "password": "TestPassword123!",
    "full_name": "Test Admin",
    "role": "admin"
}

# Global variables
access_token = None
provider_id = None
patient_id = None
appointment_id = None


def print_section(title):
    """Print a section header"""
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


def print_result(test_name, success, response=None, error=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} | {test_name}")
    if response:
        print(f"  Response: {json.dumps(response, indent=2)[:200]}...")
    if error:
        print(f"  Error: {error}")
    print()


def login():
    """Login and get access token"""
    global access_token
    print_section("1. AUTHENTICATION")

    try:
        # Only send email and password for login
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_data
        )

        if response.status_code == 200:
            data = response.json()
            access_token = data['access_token']
            print_result("Login", True, {"user": data['user']['email']})
            return True
        else:
            print_result("Login", False, error=response.json())
            return False
    except Exception as e:
        print_result("Login", False, error=str(e))
        return False


def get_headers():
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


def test_create_provider():
    """Test: Create a healthcare provider"""
    global provider_id
    print_section("2. PROVIDER MANAGEMENT - Create Provider")

    provider_data = {
        "full_name": "Dr. Sarah Johnson",
        "email": "dr.sarah@example.com",
        "phone": "+1234567890",
        "specialization": "Cardiology",
        "department": "Cardiology Department",
        "license_number": "MED123456",
        "qualification": "MD, Cardiology",
        "hpr_id": "HPR123456789",
        "facility_hfr_id": "HFR987654321",
        "bio": "Board-certified cardiologist with 15 years of experience",
        "years_of_experience": 15,
        "default_consultation_duration": 30,
        "accepts_new_patients": True
    }

    try:
        response = requests.post(
            f"{BASE_URL}/providers",
            headers=get_headers(),
            json=provider_data
        )

        if response.status_code == 201:
            data = response.json()
            provider_id = data['id']
            print_result("Create Provider", True, data)
            return True
        else:
            print_result("Create Provider", False, error=response.json())
            return False
    except Exception as e:
        print_result("Create Provider", False, error=str(e))
        return False


def test_list_providers():
    """Test: List providers"""
    print_section("3. PROVIDER MANAGEMENT - List Providers")

    try:
        response = requests.get(
            f"{BASE_URL}/providers",
            headers=get_headers()
        )

        if response.status_code == 200:
            data = response.json()
            print_result("List Providers", True, {"total": data['total'], "count": len(data['providers'])})
            return True
        else:
            print_result("List Providers", False, error=response.json())
            return False
    except Exception as e:
        print_result("List Providers", False, error=str(e))
        return False


def test_create_schedule():
    """Test: Create provider schedule"""
    print_section("4. PROVIDER SCHEDULE - Create Weekly Schedule")

    # Create schedule for Monday-Friday, 9 AM - 5 PM
    schedules = []
    for day in range(5):  # 0=Monday through 4=Friday
        schedules.append({
            "day_of_week": day,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "slot_duration": 30,
            "max_appointments_per_slot": 1,
            "break_start_time": "12:00:00",
            "break_end_time": "13:00:00",
            "notes": f"Regular schedule"
        })

    try:
        response = requests.post(
            f"{BASE_URL}/providers/{provider_id}/schedule/bulk",
            headers=get_headers(),
            json={"schedules": schedules}
        )

        if response.status_code == 201:
            data = response.json()
            print_result("Create Schedule", True, {"days_configured": len(data['schedules'])})
            return True
        else:
            print_result("Create Schedule", False, error=response.json())
            return False
    except Exception as e:
        print_result("Create Schedule", False, error=str(e))
        return False


def test_get_availability():
    """Test: Get available time slots"""
    print_section("5. AVAILABILITY - Get Available Slots")

    # Get availability for next Monday
    today = datetime.now()
    days_ahead = 0 - today.weekday()  # Monday
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')

    try:
        response = requests.get(
            f"{BASE_URL}/providers/{provider_id}/availability",
            headers=get_headers(),
            params={"date": next_monday, "duration": 30}
        )

        if response.status_code == 200:
            data = response.json()
            available_slots = [s for s in data['slots'] if s['available']]
            print_result("Get Availability", True, {
                "date": next_monday,
                "total_slots": len(data['slots']),
                "available_slots": len(available_slots)
            })
            return True
        else:
            print_result("Get Availability", False, error=response.json())
            return False
    except Exception as e:
        print_result("Get Availability", False, error=str(e))
        return False


def test_create_patient():
    """Test: Create a patient (prerequisite for appointments)"""
    global patient_id
    print_section("6. PATIENT SETUP - Create Patient")

    patient_data = {
        "full_name": "John Doe",
        "date_of_birth": "1985-05-15",
        "gender": "Male",
        "contact": "+1234567890",
        "address": "123 Main St, City, State 12345",
        "abha_address": "john.doe@abdm"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/patients",
            headers=get_headers(),
            json=patient_data
        )

        if response.status_code == 201:
            data = response.json()
            patient_id = data['id']
            print_result("Create Patient", True, {"id": patient_id, "name": data['full_name']})
            return True
        else:
            print_result("Create Patient", False, error=response.json())
            return False
    except Exception as e:
        print_result("Create Patient", False, error=str(e))
        return False


def test_book_appointment():
    """Test: Book an appointment"""
    global appointment_id
    print_section("7. APPOINTMENT BOOKING - Book New Appointment")

    # Book for next Monday at 9:30 AM
    today = datetime.now()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    appointment_time = next_monday.replace(hour=9, minute=30, second=0, microsecond=0)

    appointment_data = {
        "patient_id": patient_id,
        "provider_id": provider_id,
        "appointment_type": "consultation",
        "start_time": appointment_time.isoformat(),
        "duration": 30,
        "chief_complaint": "Chest pain and shortness of breath",
        "booking_source": "staff",
        "encounter_type": "OPD",
        "notes": "Patient reports symptoms for 2 days"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/appointments",
            headers=get_headers(),
            json=appointment_data
        )

        if response.status_code == 201:
            data = response.json()
            appointment_id = data['id']
            print_result("Book Appointment", True, {
                "id": appointment_id,
                "patient": data['patient_name'],
                "provider": data['provider_name'],
                "time": data['start_time'],
                "status": data['status']
            })
            return True
        else:
            print_result("Book Appointment", False, error=response.json())
            return False
    except Exception as e:
        print_result("Book Appointment", False, error=str(e))
        return False


def test_conflict_detection():
    """Test: Conflict detection (try to book overlapping appointment)"""
    print_section("8. CONFLICT DETECTION - Try Double Booking")

    # Try to book same time slot
    today = datetime.now()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    appointment_time = next_monday.replace(hour=9, minute=30, second=0, microsecond=0)

    conflict_data = {
        "patient_id": patient_id,
        "provider_id": provider_id,
        "appointment_type": "follow_up",
        "start_time": appointment_time.isoformat(),
        "duration": 30,
        "chief_complaint": "Follow-up visit",
        "booking_source": "staff"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/appointments",
            headers=get_headers(),
            json=conflict_data
        )

        # We EXPECT this to fail with 400
        if response.status_code == 400:
            error = response.json()
            if "conflict" in error.get('error', '').lower():
                print_result("Conflict Detection", True, {"message": "Correctly prevented double booking"})
                return True
            else:
                print_result("Conflict Detection", False, error="Wrong error type")
                return False
        else:
            print_result("Conflict Detection", False, error="Should have rejected conflicting appointment")
            return False
    except Exception as e:
        print_result("Conflict Detection", False, error=str(e))
        return False


def test_list_appointments():
    """Test: List appointments"""
    print_section("9. APPOINTMENT MANAGEMENT - List Appointments")

    try:
        response = requests.get(
            f"{BASE_URL}/appointments",
            headers=get_headers(),
            params={"provider_id": provider_id}
        )

        if response.status_code == 200:
            data = response.json()
            print_result("List Appointments", True, {"total": data['total']})
            return True
        else:
            print_result("List Appointments", False, error=response.json())
            return False
    except Exception as e:
        print_result("List Appointments", False, error=str(e))
        return False


def test_check_in():
    """Test: Check-in patient for appointment"""
    print_section("10. APPOINTMENT WORKFLOW - Check-in Patient")

    try:
        response = requests.post(
            f"{BASE_URL}/appointments/{appointment_id}/check-in",
            headers=get_headers()
        )

        if response.status_code == 200:
            data = response.json()
            print_result("Check-in Appointment", True, {
                "status": data['status'],
                "checked_in_at": data.get('checked_in_at')
            })
            return True
        else:
            print_result("Check-in Appointment", False, error=response.json())
            return False
    except Exception as e:
        print_result("Check-in Appointment", False, error=str(e))
        return False


def test_appointment_stats():
    """Test: Get appointment statistics"""
    print_section("11. ANALYTICS - Appointment Statistics")

    try:
        response = requests.get(
            f"{BASE_URL}/appointments/stats",
            headers=get_headers(),
            params={"provider_id": provider_id}
        )

        if response.status_code == 200:
            data = response.json()
            print_result("Appointment Stats", True, data)
            return True
        else:
            print_result("Appointment Stats", False, error=response.json())
            return False
    except Exception as e:
        print_result("Appointment Stats", False, error=str(e))
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  APPOINTMENT MANAGEMENT SYSTEM - API TEST SUITE")
    print("=" * 80)

    tests = [
        ("Authentication", login),
        ("Create Provider", test_create_provider),
        ("List Providers", test_list_providers),
        ("Create Schedule", test_create_schedule),
        ("Get Availability", test_get_availability),
        ("Create Patient", test_create_patient),
        ("Book Appointment", test_book_appointment),
        ("Conflict Detection", test_conflict_detection),
        ("List Appointments", test_list_appointments),
        ("Check-in", test_check_in),
        ("Statistics", test_appointment_stats)
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ FAIL | {name} - Exception: {str(e)}")
            failed += 1

    # Print summary
    print_section("TEST SUMMARY")
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0

    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    print()

    if failed == 0:
        print("🎉 ALL TESTS PASSED! Backend is fully operational.")
    else:
        print(f"⚠️  {failed} test(s) failed. Review errors above.")

    print("=" * 80)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
