#!/usr/bin/env python
"""
Test script for Service APIs
"""
import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL for the API
BASE_URL = "http://localhost:5002/api"

# Test credentials
TEST_USER = {
    "email": "admin@cvraman.health",
    "password": "Admin123!"
}


def print_response(response, title="Response"):
    """Pretty print API response"""
    print(f"\n{'='*50}")
    print(f"{title} - Status: {response.status_code}")
    print('='*50)
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)


def get_auth_token():
    """Get authentication token"""
    print("\n🔐 Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=TEST_USER
    )

    if response.status_code == 200:
        token = response.json().get('access_token')
        print("✅ Login successful!")
        return token
    else:
        print(f"❌ Login failed: {response.text}")
        sys.exit(1)


def test_service_apis(token):
    """Test all service-related APIs"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print("\n" + "="*60)
    print("TESTING SERVICE APIs")
    print("="*60)

    # 1. Get service types
    print("\n📋 1. Getting service types...")
    response = requests.get(f"{BASE_URL}/services/types", headers=headers)
    print_response(response, "Service Types")

    # 2. Get all services
    print("\n📋 2. Getting all services...")
    response = requests.get(f"{BASE_URL}/services", headers=headers)
    print_response(response, "All Services")

    services = response.json().get('services', [])

    if services:
        service_id = services[0]['id']

        # 3. Get service by ID
        print(f"\n📋 3. Getting service by ID: {service_id}...")
        response = requests.get(f"{BASE_URL}/services/{service_id}", headers=headers)
        print_response(response, "Service Details")

        # 4. Get service providers
        print(f"\n👥 4. Getting providers for service {service_id}...")
        response = requests.get(f"{BASE_URL}/services/{service_id}/providers", headers=headers)
        print_response(response, "Service Providers")

        # 5. Get service forms
        print(f"\n📝 5. Getting forms for service {service_id}...")
        response = requests.get(f"{BASE_URL}/services/{service_id}/forms", headers=headers)
        print_response(response, "Service Forms")

        # 6. Get service availability
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        print(f"\n📅 6. Getting availability for {tomorrow}...")
        response = requests.get(
            f"{BASE_URL}/services/{service_id}/availability?date={tomorrow}",
            headers=headers
        )
        print_response(response, "Service Availability")

    # 7. Get services by type
    print("\n📋 7. Getting OPD services...")
    response = requests.get(f"{BASE_URL}/services/by-type/OPD", headers=headers)
    print_response(response, "OPD Services")

    # 8. Get service statistics
    print("\n📊 8. Getting service statistics...")
    response = requests.get(f"{BASE_URL}/services/stats", headers=headers)
    print_response(response, "Service Statistics")

    print("\n" + "="*60)
    print("✅ All Service API tests completed!")
    print("="*60)


def test_appointment_api(token):
    """Test appointment API"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print("\n📅 Testing Appointment API...")
    response = requests.get(f"{BASE_URL}/appointments", headers=headers)
    print_response(response, "Appointments List")

    # Get upcoming appointments
    print("\n📅 Getting upcoming appointments...")
    response = requests.get(f"{BASE_URL}/appointments/upcoming", headers=headers)
    print_response(response, "Upcoming Appointments")


def test_patient_api(token):
    """Test patient API"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print("\n👥 Testing Patient API...")
    response = requests.get(f"{BASE_URL}/patients", headers=headers)
    print_response(response, "Patients List")


def test_provider_api(token):
    """Test provider API"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print("\n🏥 Testing Provider API...")
    response = requests.get(f"{BASE_URL}/providers", headers=headers)
    print_response(response, "Providers List")


def main():
    """Main test function"""
    print("🚀 Starting Service API Tests...")
    print(f"📍 Testing against: {BASE_URL}")

    # Get auth token
    token = get_auth_token()

    # Test Service APIs
    test_service_apis(token)

    # Test related APIs
    test_appointment_api(token)
    test_patient_api(token)
    test_provider_api(token)

    print("\n✨ All tests completed successfully!")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        sys.exit(1)