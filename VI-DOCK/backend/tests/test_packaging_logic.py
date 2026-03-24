import os
import sys
import urllib.request
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from utils.paths import get_resource_path
from core.installer import DependencyInstaller
from utils.config import get_config_manager

def test_resource_path():
    print("\n--- Testing get_resource_path ---")
    
    # Test 1: Check bin directory
    bin_path = get_resource_path("bin")
    print(f"Resolved 'bin' path: {bin_path}")
    
    if os.path.exists(bin_path):
        print("[PASS] 'bin' directory found.")
        
        # Check for a specific engine
        smina_path = os.path.join(bin_path, "smina.exe")
        if os.path.exists(smina_path):
            print(f"[PASS] Found smina.exe at: {smina_path}")
        else:
            print(f"[WARNING] smina.exe not found at expected path: {smina_path}")
    else:
        print(f"[FAIL] 'bin' directory NOT found at: {bin_path}")

def test_installer_logic():
    print("\n--- Testing DependencyInstaller ---")
    
    installer = DependencyInstaller()
    
    # Test 1: Check dependencies
    print("Checking dependencies...")
    missing = installer.check_dependencies()
    print(f"Missing dependencies detected: {missing}")
    
    # Test 2: Check URLs
    print("\nChecking Installer URLs...")
    for name, url in installer.urls.items():
        try:
            print(f"Testing URL for {name}: {url}")
            req = urllib.request.Request(url, method='HEAD')
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    print(f"[PASS] URL is reachable (Status 200)")
                else:
                    print(f"[WARNING] URL returned status: {response.status}")
        except Exception as e:
            print(f"[FAIL] Could not reach URL: {e}")

def main():
    print(f"Running tests from: {os.getcwd()}")
    print(f"Python executable: {sys.executable}")
    
    test_resource_path()
    test_installer_logic()
    
    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    main()
