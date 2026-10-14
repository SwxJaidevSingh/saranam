import sys
import os

# Add the current directory to sys.path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

try:
    from app import create_app
    from app.extensions import db
    from app.common.models import User
    from app.auth.services import AuthService

    app = create_app('development')
    with app.test_client() as client:
        print("Testing /api/auth/me...")
        # Since we don't have a real token that works in this context easily,
        # we can mock the decorator or just see if the route even loads.
        
        # Actually, let's just check if the blueprints are registered.
        print(f"Blueprints: {app.blueprints.keys()}")
        
        # Test analytics dashboard route specifically
        from flask_jwt_extended import create_access_token
        with app.app_context():
            user = User.query.first()
            token = create_access_token(identity=str(user.id))
            headers = {'Authorization': f'Bearer {token}'}
            
            print(f"Testing /api/analytics/dashboard with user {user.email}...")
            response = client.get('/api/analytics/dashboard', headers=headers)
            print(f"Response status: {response.status_code}")
            if response.status_code == 500:
                print(f"Error data: {response.get_json()}")
            
            print("Testing /api/auth/me...")
            response = client.get('/api/auth/me', headers=headers)
            print(f"Response status: {response.status_code}")
            if response.status_code == 500:
                print(f"Error data: {response.get_json()}")


except Exception as e:
    print(f"Error during diagnostics: {e}")
    import traceback
    traceback.print_exc()
