import os
import sys
import urllib.request
import ssl
import shutil
from pathlib import Path

# Configuration
BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")

URLS = {
    "qvina2.exe": "https://github.com/QVina/qvina/raw/master/bin/qvina2.exe",
    "qvina-w.exe": "https://github.com/QVina/qvina/raw/master/bin/qvina-w.exe"
}

def setup_bin_dir():
    if not os.path.exists(BIN_DIR):
        os.makedirs(BIN_DIR)
        print(f"[OK] Created bin directory: {BIN_DIR}")
    else:
        print(f"[OK] Bin directory exists: {BIN_DIR}")

def download_file(url, dest_path):
    print(f"Downloading {os.path.basename(dest_path)} from {url}...")
    try:
        # Bypass SSL verification
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        
        with urllib.request.urlopen(req, context=ctx) as response, open(dest_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        
        print(f"[OK] Downloaded to {dest_path}")
        return True
    except Exception as e:
        print(f"[FAIL] Download failed: {e}")
        return False

def main():
    print("=== Installing QuickVina 2 & QuickVina-W ===")
    setup_bin_dir()
    
    success = True
    for filename, url in URLS.items():
        dest = os.path.join(BIN_DIR, filename)
        if not download_file(url, dest):
            success = False
            
    if success:
        print("\nAll files downloaded successfully.")
    else:
        print("\nSome downloads failed.")

if __name__ == "__main__":
    main()
