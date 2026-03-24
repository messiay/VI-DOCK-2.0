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

def test_full_features():
    print("\n--- Testing Full Features ---")
    
    # 1. System
    r = requests.get(f"{BASE_URL}/system/info")
    assert r.status_code == 200
    
    # 2. Project
    project_name = f"FeatureTest_{int(time.time())}"
    r = requests.post(f"{BASE_URL}/projects/", json={"name": project_name})
    assert r.status_code == 200
    print(f"[OK] Created Project: {project_name}")
    
    # 3. Upload File (Ligand)
    # Create a dummy PDB with atom coordinates for GridBox testing
    dummy_pdb = "ATOM      1  N   ALA A   1      30.000  40.000  50.000  1.00  0.00           N"
    with open("dummy_model.pdb", "w") as f:
        f.write(dummy_pdb)
        
    files = {'file': ('dummy_model.pdb', open("dummy_model.pdb", "rb"))}
    r = requests.post(f"{BASE_URL}/projects/{project_name}/upload", files=files)
    assert r.status_code == 200
    print(f"[OK] Uploaded Dummy Ligand")
    
    # 4. GridBox Calc
    r = requests.post(f"{BASE_URL}/analysis/{project_name}/gridbox?ligand_file=dummy_model.pdb")
    if r.status_code == 200:
        gb = r.json()
        print(f"[OK] GridBox Calculated: {gb}")
        assert gb['center_x'] == 30.0
    else:
        print(f"[FAIL] GridBox Error: {r.text}")

    # 5. History
    r = requests.get(f"{BASE_URL}/projects/{project_name}/history")
    assert r.status_code == 200
    print(f"[OK] History Retrieved: {len(r.json())} sessions")

if __name__ == "__main__":
    if not wait_for_api():
        sys.exit(1)
    
    try:
        test_full_features()
        print("\n[SUCCESS] Feature Verification Passed!")
    except Exception as e:
        print(f"\n[FAILURE] {e}")
        sys.exit(1)
