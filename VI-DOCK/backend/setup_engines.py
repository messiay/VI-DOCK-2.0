import os
import sys
import urllib.request
import zipfile
import shutil
import ssl
import subprocess

# Configuration
BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")

# Direct download URLs (Best effort)
URLS = {
    "ad4_installer": "https://autodock.scripps.edu/wp-content/uploads/sites/56/2021/10/autodocksuite-4.2.6.i86Windows.exe",
    "ledock": "http://www.lephar.com/download/ledock_win32.exe",
    "vina_gpu": "https://github.com/DeltaGroupNJUPT/Vina-GPU-2.1/raw/main/Vina-GPU-2.1/Vina-GPU-2.1/Vina-GPU.exe",
    "vina_gpu_kernel": "https://github.com/DeltaGroupNJUPT/Vina-GPU-2.1/raw/main/Vina-GPU-2.1/Vina-GPU-2.1/Kernel2_Opt.bin"
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
        # Bypass SSL verification for legacy servers
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        # User-Agent to avoid 403s
        req = urllib.request.Request(
            url, 
            data=None, 
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        )
        
        with urllib.request.urlopen(req, context=ctx) as response, open(dest_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print(f"[OK] Downloaded to {dest_path}")
        return True
    except Exception as e:
        print(f"[WARNING] Python download failed: {e}")
        print("Retrying with curl...")
        try:
            # Use curl.exe explicitly to avoid PowerShell alias issues
            subprocess.run(["curl.exe", "-L", "-o", dest_path, url], check=True)
            print(f"[OK] Downloaded to {dest_path} (via curl)")
            return True
        except Exception as e2:
            print(f"[ERROR] Failed to download with curl: {e2}")
            return False

def setup_vina():
    # Vina is now handled by Smina fallback or manual install
    vina_exe = os.path.join(BIN_DIR, "vina.exe")
    if os.path.exists(vina_exe):
        print(f"[OK] AutoDock Vina found at {vina_exe}")
    else:
        print("[INFO] AutoDock Vina not found. VI DOCK will use Smina (compatible) if available.")

def setup_qvina():
    # QuickVina is now handled by manual install
    qvina_exe = os.path.join(BIN_DIR, "qvina.exe")
    if os.path.exists(qvina_exe):
        print(f"[OK] QuickVina 2 found at {qvina_exe}")
    else:
        print("[INFO] QuickVina 2 not found (Manual install required).")

def setup_ad4():
    installer_path = os.path.join(BIN_DIR, "autodock_installer.exe")
    if os.path.exists(installer_path):
        print(f"[OK] AutoDock 4 Installer found at {installer_path}")
    else:
        print("Downloading AutoDock 4 Installer...")
        download_file(URLS["ad4_installer"], installer_path)
        print("[INFO] Please run 'autodock_installer.exe' manually to install AutoDock 4.")

def setup_ledock():
    # Check both single file and folder
    ledock_exe = os.path.join(BIN_DIR, "ledock.exe")
    ledock_folder_exe = os.path.join(BIN_DIR, "ledock", "LeDock.exe")
    
    if (os.path.exists(ledock_exe) and os.path.getsize(ledock_exe) > 1000) or \
       (os.path.exists(ledock_folder_exe) and os.path.getsize(ledock_folder_exe) > 1000):
        print(f"[OK] LeDock found.")
    else:
        print("[INFO] LeDock not found (Manual install required).")

def setup_vina_gpu():
    vina_gpu_exe = os.path.join(BIN_DIR, "vina_gpu.exe")
    if os.path.exists(vina_gpu_exe) and os.path.getsize(vina_gpu_exe) > 1000:
        print(f"[OK] Vina-GPU+ found at {vina_gpu_exe}")
    else:
        print("[INFO] Vina-GPU+ not found (Manual install required).")

def setup_plants():
    plants_exe = os.path.join(BIN_DIR, "plants.exe")
    if os.path.exists(plants_exe):
        print(f"[OK] PLANTS found at {plants_exe}")
    else:
        print("[INFO] PLANTS requires manual installation (License restricted).")

def print_instructions():
    print("\n=== Engine Setup Summary ===")
    
    # Check Vina
    if os.path.exists(os.path.join(BIN_DIR, "vina.exe")):
        print("[INSTALLED] AutoDock Vina")
    else:
        print("[MISSING] AutoDock Vina (Use Smina)")

    # Check QuickVina
    if os.path.exists(os.path.join(BIN_DIR, "qvina.exe")):
        print("[INSTALLED] QuickVina 2")
    else:
        print("[MISSING] QuickVina 2")

    # Check AutoDock 4
    if os.path.exists(os.path.join(BIN_DIR, "autodock_installer.exe")):
        print("[DOWNLOADED] AutoDock 4 Installer (Run this file to install)")
    else:
        print("[MISSING] AutoDock 4 Installer")

    # Check LeDock
    ledock_path = os.path.join(BIN_DIR, "ledock.exe")
    ledock_folder_path = os.path.join(BIN_DIR, "ledock", "LeDock.exe")
    if (os.path.exists(ledock_path) and os.path.getsize(ledock_path) > 1000) or \
       (os.path.exists(ledock_folder_path) and os.path.getsize(ledock_folder_path) > 1000):
        print("[INSTALLED] LeDock")
    else:
        print("[MISSING] LeDock (Manual Download Required)")

    # Check Vina-GPU
    vina_gpu_path = os.path.join(BIN_DIR, "vina_gpu.exe")
    if os.path.exists(vina_gpu_path) and os.path.getsize(vina_gpu_path) > 1000:
        print("[INSTALLED] Vina-GPU+")
    else:
        print("[MISSING] Vina-GPU+ (Manual Download Required)")

    print("\n=== Manual Installation Required ===")
    print("The following engines require manual download due to license/hosting restrictions:")
    
    print("\n1. LeDock")
    print("   - Download 'ledock_win32.exe' from: http://www.lephar.com/download.htm")
    print("   - Rename to 'ledock.exe' and place in 'bin' folder.")

    print("\n2. Vina-GPU+")
    print("   - Download from GitHub: https://github.com/DeltaGroupNJUPT/Vina-GPU-2.1")
    print("   - You need 'Vina-GPU.exe' and 'Kernel2_Opt.bin'.")
    print("   - Place both in 'bin' folder (rename executable to 'vina_gpu.exe').")

    print("\n3. PLANTS")
    print("   - Requires academic license.")
    print("   - Place 'plants.exe' in 'bin' folder.")

    print("\n4. Smina & Gnina")
    print("   - Install via Conda (Smina installed automatically if possible).")
    print("   - Gnina requires WSL.")

if __name__ == "__main__":
    setup_bin_dir()
    setup_vina()
    setup_qvina()
    setup_ad4()
    setup_ledock()
    setup_vina_gpu()
    setup_plants()
    print_instructions()
    input("\nPress Enter to exit...")
