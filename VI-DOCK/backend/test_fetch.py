import requests

PROJECT = "demo_session"
BASE_URL = "http://127.0.0.1:8000"

def test_fetch(source, id):
    print(f"Testing Fetch {source.upper()} {id}...")
    try:
        # Check Root first
        try:
             requests.get(f"{BASE_URL}/")
        except:
             print("API Root not accessible")
             return

        url = f"{BASE_URL}/projects/{PROJECT}/fetch"
        print(f"POST {url}")
        resp = requests.post(url, params={"source": source, "id": id})
        
        if resp.status_code == 200:
            print("SUCCESS:", resp.json()['status'])
            print("File:", resp.json()['filename'])
        else:
            print("FAILED:", resp.status_code, resp.text)
    except Exception as e:
        print("ERROR:", e)

# Test PDB
test_fetch("pdb", "1CBS")

# Test UniProt (AlphaFold) - p53
test_fetch("uniprot", "P04637")
