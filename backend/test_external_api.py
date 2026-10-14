"""Test script for External API integration."""
import requests
import json
from datetime import datetime

API_KEY = "cvr_dDucyvjcuBDn0WNM4sXHPGdmK8_dE63zojgVJIb5cGc"
BASE_URL = "http://localhost:5002"

def test_health():
    """Test health endpoint."""
    print("\n" + "="*70)
    print("TEST 1: Health Check")
    print("="*70)

    response = requests.get(f"{BASE_URL}/api/external/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

    assert response.status_code == 200, "Health check failed"
    assert response.json()['status'] == 'healthy', "Service not healthy"
    print("✓ Health check passed")

def test_authentication():
    """Test API key authentication."""
    print("\n" + "="*70)
    print("TEST 2: API Key Authentication")
    print("="*70)

    headers = {'X-API-Key': API_KEY}
    response = requests.post(f"{BASE_URL}/api/external/auth/token", headers=headers)

    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

    assert response.status_code == 200, "Authentication failed"
    data = response.json()
    assert 'access_token' in data, "No access token returned"
    assert 'user' in data, "No user data returned"
    assert data['user']['email'] == 'healthscreening_sync@system', "Wrong user"

    print("✓ Authentication passed")
    return data['access_token']

def test_list_forms(token):
    """Test listing forms."""
    print("\n" + "="*70)
    print("TEST 3: List Forms")
    print("="*70)

    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/api/external/forms?limit=5", headers=headers)

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"Total forms: {data['total']}")
        if data['forms']:
            print(f"\nFirst form:")
            print(json.dumps(data['forms'][0], indent=2))
        print("✓ List forms passed")
        return data['forms'][0]['id'] if data['forms'] else None
    else:
        print(f"Error: {response.text}")
        return None

def test_create_submission(token, form_id):
    """Test creating a submission."""
    if not form_id:
        print("\n⚠️  Skipping submission test - no forms available")
        return

    print("\n" + "="*70)
    print("TEST 4: Create Submission")
    print("="*70)

    submission_data = {
        "form_id": form_id,
        "data": {
            "patient_name": "Test Patient from External API",
            "age": 35,
            "gender": "Male",
            "visit_date": datetime.now().date().isoformat()
        },
        "external_context": {
            "source_system": "health_screening",
            "external_submission_id": f"test_{int(datetime.now().timestamp())}",
            "external_patient_id": "test_patient_123",
            "external_form_id": "10",
            "metadata": {
                "camp_id": 999,
                "camp_name": "Test Camp - Integration Test",
                "latitude": 25.5941,
                "longitude": 85.1376,
                "test": True
            }
        }
    }

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(
        f"{BASE_URL}/api/external/submissions",
        headers=headers,
        json=submission_data
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

    if response.status_code in [200, 201]:
        print("✓ Create submission passed")
        return response.json().get('submission_id')
    else:
        print("✗ Create submission failed")
        return None

def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("EXTERNAL API INTEGRATION TEST SUITE")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY[:20]}...")

    try:
        # Test 1: Health check
        test_health()

        # Test 2: Authentication
        token = test_authentication()

        # Test 3: List forms
        form_id = test_list_forms(token)

        # Test 4: Create submission
        if form_id:
            submission_id = test_create_submission(token, form_id)

        print("\n" + "="*70)
        print("✅ ALL TESTS COMPLETED")
        print("="*70)

    except AssertionError as e:
        print(f"\n❌ Test failed: {str(e)}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
