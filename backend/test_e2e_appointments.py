#!/usr/bin/env python3
"""
End-to-End Appointment System Test
Tests the complete appointment workflow from provider setup to appointment completion
"""

import requests
import json
from datetime import datetime, timedelta

import time

BASE_URL = "http://127.0.0.1:5001/api"

# Test user credentials
timestamp = int(time.time())
TEST_USER = {
    "email": f"e2e_test_{timestamp}@example.com",
    "password": "Test123!@#"
}

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_step(step_num, description):
    print(f"\n{BLUE}{'='*80}")
    print(f"STEP {step_num}: {description}")
    print(f"{'='*80}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

# Global variables
access_token = None
provider_id = None
patient_id = None
appointment_id = None

def register_user():
    """Register a new test user"""
    print_info("Attempting to register new user...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": TEST_USER["email"],
                "password": TEST_USER["password"],
                "full_name": "Test User",
                "role": "admin"
            }
        )

        if response.status_code == 201:
            print_success("User registered successfully!")
            return True
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print_info("User already exists, proceeding with login...")
            return True
        else:
            print_error(f"Registration failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error during registration: {str(e)}")
        return False

def login():
    """Login and get access token"""
    print_step(1, "LOGIN / REGISTER")
    try:
        # Try login first
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": TEST_USER["email"],
                "password": TEST_USER["password"]
            }
        )

        if response.status_code == 200:
            data = response.json()
            global access_token
            access_token = data.get('access_token')
            print_success(f"Login successful! Token: {access_token[:20]}...")
            return True
        elif response.status_code == 401:
            # Try to register if login fails
            if register_user():
                # Try login again
                response = requests.post(
                    f"{BASE_URL}/auth/login",
                    json={
                        "email": TEST_USER["email"],
                        "password": TEST_USER["password"]
                    }
                )
                if response.status_code in [200, 201]:
                    data = response.json()
                    if 'session' in data and data['session']:
                        access_token = data['session'].get('access_token')
                    else:
                        access_token = data.get('access_token')
                    print_success(f"Login successful after registration! Token: {access_token[:20]}...")
                    return True
                else:
                    print_error(f"Login failed after registration: {response.status_code}")
                    return False
            else:
                return False
        else:
            print_error(f"Login failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error during login: {str(e)}")
        return False

def create_provider():
    """Create a healthcare provider"""
    print_step(2, "CREATE HEALTHCARE PROVIDER")
    try:
        import time
        timestamp = int(time.time())
        provider_data = {
            "full_name": f"Dr. Emily Chen (Test {timestamp})",
            "specialization": "Family Medicine",
            "department": "Outpatient",
            "license_number": f"FM-TEST-{timestamp}",
            "email": "dr.emily.chen@cvhealth.com",
            "phone": "+91-9876543210",
            "qualification": "MBBS, MD (Family Medicine)",
            "years_of_experience": 8,
            "consultation_fee": 500,
            "available_for_teleconsult": True,
            "bio": "Dr. Emily Chen is a board-certified family medicine physician with 8 years of experience in primary care.",
            "languages_spoken": ["English", "Hindi", "Tamil"]
        }

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/providers",
            json=provider_data,
            headers=headers
        )

        if response.status_code == 201:
            data = response.json()
            global provider_id
            # Try different response structures
            if 'provider' in data:
                provider_id = data['provider'].get('id')
                provider_data = data['provider']
            else:
                provider_id = data.get('id')
                provider_data = data

            print_success(f"Provider created! ID: {provider_id}")
            print_info(f"Name: {provider_data.get('full_name')}")
            print_info(f"Specialization: {provider_data.get('specialization')}")
            print_info(f"Full response keys: {list(data.keys())}")
            return True
        else:
            print_error(f"Failed to create provider: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error creating provider: {str(e)}")
        return False

def setup_provider_schedule():
    """Setup weekly schedule for the provider"""
    print_step(3, "SETUP PROVIDER SCHEDULE")
    try:
        # Setup Monday to Friday, 9 AM to 5 PM with 1-hour lunch break
        schedules = []
        for day in range(5):  # Monday (0) to Friday (4)
            schedules.append({
                "day_of_week": day,
                "start_time": "09:00:00",
                "end_time": "17:00:00",
                "slot_duration": 30,
                "max_appointments_per_slot": 1,
                "break_start_time": "13:00:00",
                "break_end_time": "14:00:00",
                "is_active": True
            })

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/providers/{provider_id}/schedule/bulk",
            json={"schedules": schedules},
            headers=headers
        )

        if response.status_code == 201:
            data = response.json()
            print_success(f"Schedule created! {len(data.get('schedules', []))} days configured")
            print_info("Working hours: Monday-Friday, 9 AM - 5 PM")
            print_info("Lunch break: 1 PM - 2 PM")
            print_info("Slot duration: 30 minutes")
            return True
        else:
            print_error(f"Failed to create schedule: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error setting up schedule: {str(e)}")
        return False

def check_availability():
    """Check available slots for the provider"""
    print_step(4, "CHECK AVAILABLE SLOTS")
    try:
        # Get slots for next week Monday (to ensure schedule is active)
        today = datetime.now()
        # Calculate days until next Monday
        days_ahead = 0 - today.weekday()  # Monday is 0
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        # Add extra week to be safe
        days_ahead += 7
        next_monday = today + timedelta(days=days_ahead)
        date_str = next_monday.strftime('%Y-%m-%d')

        print_info(f"Checking availability for: {date_str} ({next_monday.strftime('%A')})")

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/providers/{provider_id}/availability",
            params={"date": date_str, "duration": 30},
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])
            available_slots = [s for s in slots if s.get('is_available')]
            print_success(f"Found {len(available_slots)} available slots on {date_str}")

            if available_slots:
                print_info(f"First available slot: {available_slots[0].get('start_time')}")
                print_info(f"Last available slot: {available_slots[-1].get('start_time')}")
                return date_str, available_slots[0].get('start_time')
            else:
                print_error("No available slots found!")
                return None, None
        else:
            print_error(f"Failed to check availability: {response.status_code}")
            print_info(f"Response: {response.text}")
            return None, None
    except Exception as e:
        print_error(f"Error checking availability: {str(e)}")
        return None, None

def create_patient():
    """Create a test patient"""
    print_step(5, "CREATE PATIENT")
    try:
        patient_data = {
            "full_name": "Rajesh Kumar",
            "date_of_birth": "1985-06-15",
            "gender": "Male",  # Capitalized as per schema requirements
            "phone_number": "+91-9988776655",
            "email": "rajesh.kumar@example.com",
            "address_line1": "123 Main Street",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "country": "India",
            "postal_code": "600001"
        }

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/patients",
            json=patient_data,
            headers=headers
        )

        if response.status_code == 201:
            data = response.json()
            global patient_id
            patient_id = data.get('patient', {}).get('id')
            mrn = data.get('patient', {}).get('medical_record_number')
            print_success(f"Patient created! ID: {patient_id}")
            print_info(f"Name: {data.get('patient', {}).get('full_name')}")
            print_info(f"MRN: {mrn}")
            return True
        else:
            print_error(f"Failed to create patient: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error creating patient: {str(e)}")
        return False

def book_appointment(date, time):
    """Book an appointment"""
    print_step(6, "BOOK APPOINTMENT")
    try:
        start_datetime = f"{date}T{time}"

        appointment_data = {
            "patient_id": patient_id,
            "provider_id": provider_id,
            "appointment_type": "consultation",
            "start_time": start_datetime,
            "duration": 30,
            "chief_complaint": "Annual health check-up and blood pressure monitoring",
            "notes": "Patient has history of mild hypertension"
        }

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/appointments",
            json=appointment_data,
            headers=headers
        )

        if response.status_code == 201:
            data = response.json()
            global appointment_id
            # Try different response structures
            if 'appointment' in data:
                appointment_id = data['appointment'].get('id')
                apt_data = data['appointment']
            else:
                appointment_id = data.get('id')
                apt_data = data

            print_success(f"Appointment booked! ID: {appointment_id}")
            print_info(f"Patient: {apt_data.get('patient_name', 'N/A')}")
            print_info(f"Provider: {apt_data.get('provider_name', 'N/A')}")
            print_info(f"Time: {apt_data.get('start_time', 'N/A')}")
            print_info(f"Status: {apt_data.get('status', 'N/A')}")
            print_info(f"Full response keys: {list(data.keys())}")
            return True
        else:
            print_error(f"Failed to book appointment: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error booking appointment: {str(e)}")
        return False

def check_in_patient():
    """Check in the patient"""
    print_step(7, "CHECK-IN PATIENT")
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/appointments/{appointment_id}/check-in",
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            print_success(f"Patient checked in successfully!")
            print_info(f"Status: {data.get('appointment', {}).get('status')}")
            print_info(f"Check-in time: {data.get('appointment', {}).get('check_in_time')}")
            return True
        else:
            print_error(f"Failed to check in: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error checking in patient: {str(e)}")
        return False

def complete_appointment():
    """Complete the appointment"""
    print_step(8, "COMPLETE APPOINTMENT")
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/appointments/{appointment_id}/complete",
            json={"notes": "Patient examined. Blood pressure: 130/85. Advised lifestyle modifications and follow-up in 3 months."},
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            print_success(f"Appointment completed successfully!")
            print_info(f"Status: {data.get('appointment', {}).get('status')}")
            return True
        else:
            print_error(f"Failed to complete appointment: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error completing appointment: {str(e)}")
        return False

def verify_stats():
    """Verify appointment statistics"""
    print_step(9, "VERIFY STATISTICS")
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/appointments/stats",
            params={"provider_id": provider_id},
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            stats = data.get('stats', {})
            print_success(f"Statistics retrieved successfully!")
            print_info(f"Total appointments: {stats.get('total_appointments', 0)}")
            print_info(f"Completed: {stats.get('completed_appointments', 0)}")
            print_info(f"Scheduled: {stats.get('scheduled_appointments', 0)}")
            print_info(f"Cancelled: {stats.get('cancelled_appointments', 0)}")
            return True
        else:
            print_error(f"Failed to get stats: {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error getting stats: {str(e)}")
        return False

def test_conflict_detection(date, time):
    """Test conflict detection by trying to book at the same time"""
    print_step(10, "TEST CONFLICT DETECTION")
    try:
        start_datetime = f"{date}T{time}"

        appointment_data = {
            "patient_id": patient_id,
            "provider_id": provider_id,
            "appointment_type": "follow_up",
            "start_time": start_datetime,
            "duration": 30,
            "chief_complaint": "This should fail - conflict!"
        }

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            f"{BASE_URL}/appointments",
            json=appointment_data,
            headers=headers
        )

        if response.status_code == 400:
            print_success(f"Conflict detection working! Booking correctly rejected.")
            print_info(f"Error message: {response.json().get('message', 'No message')}")
            return True
        else:
            print_error(f"Conflict detection failed! Booking should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error testing conflict detection: {str(e)}")
        return False

def main():
    """Run all end-to-end tests"""
    print(f"{BLUE}")
    print("=" * 80)
    print("END-TO-END APPOINTMENT SYSTEM TEST")
    print("=" * 80)
    print(f"{RESET}")

    test_results = []

    # Run tests in sequence
    if login():
        test_results.append(("Login", True))

        if create_provider():
            test_results.append(("Create Provider", True))

            if setup_provider_schedule():
                test_results.append(("Setup Schedule", True))

                date, time = check_availability()
                # Use hardcoded time if availability check fails (known issue with effective_from date)
                if not date or not time:
                    print_info("Using hardcoded date/time for appointment (availability check limitation)")
                    today = datetime.now()
                    days_ahead = 0 - today.weekday() if today.weekday() != 0 else 0
                    if days_ahead <= 0:
                        days_ahead += 7
                    days_ahead += 7
                    next_monday = today + timedelta(days=days_ahead)
                    date = next_monday.strftime('%Y-%m-%d')
                    time = "10:00:00"  # 10 AM
                    test_results.append(("Check Availability", False))
                else:
                    test_results.append(("Check Availability", True))

                if create_patient():
                    test_results.append(("Create Patient", True))

                    if book_appointment(date, time):
                        test_results.append(("Book Appointment", True))

                        if check_in_patient():
                            test_results.append(("Check-in Patient", True))

                            if complete_appointment():
                                test_results.append(("Complete Appointment", True))

                                if verify_stats():
                                    test_results.append(("Verify Stats", True))
                                else:
                                    test_results.append(("Verify Stats", False))
                            else:
                                test_results.append(("Complete Appointment", False))
                        else:
                            test_results.append(("Check-in Patient", False))

                        # Test conflict detection
                        if test_conflict_detection(date, time):
                            test_results.append(("Conflict Detection", True))
                        else:
                            test_results.append(("Conflict Detection", False))
                    else:
                        test_results.append(("Book Appointment", False))
                else:
                    test_results.append(("Create Patient", False))
            else:
                test_results.append(("Setup Schedule", False))
        else:
            test_results.append(("Create Provider", False))
    else:
        test_results.append(("Login", False))

    # Print summary
    print(f"\n{BLUE}{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}{RESET}")

    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)

    for test_name, result in test_results:
        status = f"{GREEN}✓ PASSED{RESET}" if result else f"{RED}✗ FAILED{RESET}"
        print(f"{test_name:.<50} {status}")

    print(f"\n{BLUE}{'='*80}")
    success_rate = (passed / total * 100) if total > 0 else 0
    color = GREEN if success_rate == 100 else YELLOW if success_rate >= 70 else RED
    print(f"Results: {passed}/{total} tests passed ({color}{success_rate:.1f}%{RESET})")
    print(f"{'='*80}{RESET}\n")

    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
