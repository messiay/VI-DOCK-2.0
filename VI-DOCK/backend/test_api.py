import requests
import time
import os
import sys

BASE_URL = "http://127.0.0.1:8000"

def wait_for_api():
    print("Waiting for API to start...")
    for i in range(10):
        try:
            r = requests.get(f"{BASE_URL}/")
            if r.status_code == 200:
                print("API is online!")
                return True
        except requests.ConnectionError:
            pass
        time.sleep(2)
    return False

def test_system():
    print("\n--- Testing System ---")
    r = requests.get(f"{BASE_URL}/system/info")
    print(f"Info: {r.status_code} - {r.json()}")
    assert r.status_code == 200
    
    r = requests.get(f"{BASE_URL}/system/engines")
    print(f"Engines: {r.status_code} - {r.json()}")
    assert r.status_code == 200

def test_projects():
    print("\n--- Testing Projects ---")
    # Create
    project_name = f"TestProject_{int(time.time())}"
    payload = {"name": project_name, "description": "API Test"}
    r = requests.post(f"{BASE_URL}/projects/", json=payload)
    print(f"Create Project: {r.status_code} - {r.json()}")
    assert r.status_code == 200
    
    # List
    r = requests.get(f"{BASE_URL}/projects/")
    projects = r.json()
    print(f"List Projects: Found {len(projects)}")
    assert len(projects) > 0
    
    # Upload Dummy File
    dummy_content = b"REMARK  DUMMY PDB FILE"
    files = {'file': ('test.pdb', dummy_content)}
    r = requests.post(f"{BASE_URL}/projects/{project_name}/upload", files=files)
    print(f"Upload File: {r.status_code} - {r.json()}")
    assert r.status_code == 200

if __name__ == "__main__":
    if not wait_for_api():
        sys.exit(1)
        
    try:
        test_system()
        test_projects()
        print("\n[SUCCESS] API Verification Passed!")
    except Exception as e:
        print(f"\n[FAILURE] API Verification Failed: {e}")
        sys.exit(1)
