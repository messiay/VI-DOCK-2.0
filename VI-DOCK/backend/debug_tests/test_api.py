
import os
import sys
import threading
import time
from fastapi.testclient import TestClient

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=== API Connectivity Test ===")

try:
    from api.main import app
    print("✅ Application loaded")
    
    with TestClient(app) as client:
        print("Testing Root Endpoint...")
        response = client.get("/")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Root Endpoint OK")
        else:
            print("❌ Root Endpoint Failed")
            
        print("\nTesting Projects Endpoint...")
        response = client.get("/projects")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Projects Endpoint OK")
        else:
            print("❌ Projects Endpoint Failed")

except ImportError as e:
    print(f"❌ Failed to load application: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
