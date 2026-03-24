import os
import sys
import urllib.request
import subprocess
import shutil
import time

# Configuration
MINICONDA_URL = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"
USER_PROFILE = os.environ.get("USERPROFILE")
MINICONDA_INSTALL_DIR = os.path.join(USER_PROFILE, "Miniconda3")
CONDA_EXE = os.path.join(MINICONDA_INSTALL_DIR, "Scripts", "conda.exe")
# Fallback location
CONDA_BAT = os.path.join(MINICONDA_INSTALL_DIR, "condabin", "conda.bat")

BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")

def download_miniconda(dest_path):
    print(f"Downloading Miniconda installer from {MINICONDA_URL}...")
    try:
        # User-Agent to avoid 403s
        req = urllib.request.Request(
            MINICONDA_URL, 
            data=None, 
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        )
        with urllib.request.urlopen(req) as response, open(dest_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print(f"[OK] Downloaded to {dest_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to download Miniconda: {e}")
        return False

def install_miniconda(installer_path):
    print("Installing Miniconda (this may take a few minutes)...")
    # Silent install arguments
    # /InstallationType=JustMe /RegisterPython=0 /S /D=%UserProfile%\Miniconda3
    cmd = [
        installer_path,
        "/InstallationType=JustMe",
        "/RegisterPython=0",
        "/S",
        f"/D={MINICONDA_INSTALL_DIR}"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("[OK] Miniconda installation completed.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Miniconda installation failed: {e}")
        return False

def get_conda_command():
    if os.path.exists(CONDA_EXE):
        return CONDA_EXE
    elif os.path.exists(CONDA_BAT):
        return CONDA_BAT
    else:
        # Check if conda is in PATH
        conda_in_path = shutil.which("conda")
        if conda_in_path:
            return conda_in_path
    return None

def install_engines(conda_cmd):
    print("Accepting Conda Terms of Service...")
    # Attempt to accept TOS for default channels
    tos_channels = [
        "https://repo.anaconda.com/pkgs/main",
        "https://repo.anaconda.com/pkgs/r",
        "https://repo.anaconda.com/pkgs/msys2"
    ]
    
    for channel in tos_channels:
        try:
            subprocess.run([conda_cmd, "tos", "accept", "--override-channels", "--channel", channel], check=False)
        except Exception:
            pass

    print("Installing Smina via Conda (with Python 3.10)...")
    print("Note: Gnina is not available for Windows via Conda. Please use WSL for Gnina.")
    
    # conda install -c conda-forge smina python=3.10 -y
    cmd = [
        conda_cmd,
        "install",
        "-c", "conda-forge",
        "smina",
        "python=3.10",
        "-y"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("[OK] Engines installed successfully.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Engine installation failed: {e}")
        return False

def locate_and_copy_engines():
    print("Locating installed engines...")
    # They should be in Miniconda3/Library/bin or Miniconda3/bin or Miniconda3/condabin
    # On Windows, conda packages often put binaries in Library/bin
    
    search_paths = [
        os.path.join(MINICONDA_INSTALL_DIR, "Library", "bin"),
        os.path.join(MINICONDA_INSTALL_DIR, "bin"),
        os.path.join(MINICONDA_INSTALL_DIR, "Scripts")
    ]
    
    engines = ["smina.exe", "gnina.exe"]
    
    for engine in engines:
        found = False
        for path in search_paths:
            source = os.path.join(path, engine)
            if os.path.exists(source):
                dest = os.path.join(BIN_DIR, engine)
                try:
                    shutil.copy2(source, dest)
                    print(f"[OK] Copied {engine} to {BIN_DIR}")
                    found = True
                    break
                except Exception as e:
                    print(f"[ERROR] Failed to copy {engine}: {e}")
        
        if not found:
            print(f"[WARNING] Could not find {engine} in Conda directories.")

def main():
    if not os.path.exists(BIN_DIR):
        os.makedirs(BIN_DIR)
        
    # Check if Conda is already installed
    conda_cmd = get_conda_command()
    
    if not conda_cmd:
        installer_path = os.path.join(BIN_DIR, "miniconda_installer.exe")
        if download_miniconda(installer_path):
            if install_miniconda(installer_path):
                # Wait a bit for file system to sync
                time.sleep(5)
                conda_cmd = get_conda_command()
                
                # Cleanup installer
                try:
                    os.remove(installer_path)
                except:
                    pass
    
    if conda_cmd:
        print(f"Using Conda at: {conda_cmd}")
        if install_engines(conda_cmd):
            locate_and_copy_engines()
    else:
        print("[ERROR] Could not find or install Conda.")

if __name__ == "__main__":
    main()
