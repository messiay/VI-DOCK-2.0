import sys
import os
import subprocess
import shutil
from pathlib import Path

# Fix import path for core modules
sys.path.append(os.getcwd())

def check_wsl():
    print("\n--- Checking WSL Status ---")
    try:
        result = subprocess.run(["wsl", "--list", "--verbose"], capture_output=True, text=True)
        if result.returncode == 0:
            print("[OK] WSL is available.")
            print(result.stdout.strip())
            return True
        else:
            print("[FAIL] WSL command failed.")
            print(result.stderr)
            return False
    except FileNotFoundError:
        print("[FAIL] WSL executable not found.")
        return False

def check_binary(name, path_str):
    print(f"\n--- Checking {name} ---")
    path = Path(path_str)
    if path.exists():
        print(f"[OK] {name} binary found at: {path}")
        # Try running help
        try:
            # Using Vina-like help flag
            cmd = [str(path), "--help"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if result.returncode == 0 or "--help" in result.stdout or "usage" in result.stdout.lower():
                 print(f"[OK] {name} runs successfully (help output received).")
            else:
                 print(f"[WARNING] {name} ran but returned uncommon output/code.")
                 # Some engines allow no args or different help
        except Exception as e:
             print(f"[FAIL] {name} execution failed: {e}")
        return True
    else:
        print(f"[FAIL] {name} binary NOT found at: {path}")
        return False

def check_wsl_tool(name, check_cmd):
    print(f"\n--- Checking {name} (WSL) ---")
    try:
        # Run check command in WSL (e.g., 'which rbdock')
        cmd = ["wsl", "bash", "-c", check_cmd]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            print(f"[OK] {name} found in WSL: {result.stdout.strip()}")
            return True
        else:
            print(f"[FAIL] {name} NOT found in WSL.")
            print(f"Debug Info: {result.stderr}")
            return False
    except Exception as e:
        print(f"[FAIL] Failed to check {name} in WSL: {e}")
        return False

def main():
    print("=== VI DOCK Pro 3.1 - Master Engine Verification ===\n")
    
    # 1. Check AutoDock-GPU
    bin_dir = Path.cwd() / "bin"
    check_binary("AutoDock-GPU", bin_dir / "vina_gpu.exe")
    check_binary("Kernel2_Opt", bin_dir / "Kernel2_Opt.bin") # Not exec, but required
    
    # 2. Check Other Windows Binaries
    check_binary("Smina", bin_dir / "smina.exe")
    
    # 3. Check WSL Connectivity
    if check_wsl():
        # QuickVina via WSL (Linux binaries)
        bin_dir_wsl = f"/mnt/c{str(bin_dir)[2:].replace(os.sep, '/')}"
        
        check_wsl_tool("QuickVina 2 (WSL)", f"'{bin_dir_wsl}/qvina2' --help")
        check_wsl_tool("QuickVina-W (WSL)", f"'{bin_dir_wsl}/qvina-w' --help")
        
        # 4. Check Linux Tools via WSL
        # Assuming typical installation paths or PATH availability
        check_wsl_tool("rDock (rbdock)", "which rbdock")
        
        # Check rbcavity in PATH or miniconda
        check_wsl_tool("rDock (rbcavity)", "command -v rbcavity || ls /root/miniconda3/bin/rbcavity")
        
        check_wsl_tool("Gnina", "which gnina")
        
        # Check LeDock: It might be a local binary run via WSL
        # We check if the binary exists in our bin folder first
        ledock_bin = bin_dir / "ledock_linux_x86"
        if ledock_bin.exists():
             print(f"\n--- Checking LeDock ---")
             print(f"[OK] LeDock binary found at: {ledock_bin}")
             # It runs via WSL, so we can try to check if it executes
             wsl_path = f"'/mnt/c{str(ledock_bin)[2:].replace(os.sep, '/')}'" # Quote path
             # LeDock usually needs arguments or prints help
             check_wsl_tool(f"LeDock (via WSL)", f"{wsl_path} -h || {wsl_path} --help")
        else:
             print(f"\n--- Checking LeDock ---")
             print(f"[FAIL] LeDock binary not found in bin directory: {ledock_bin}")
    else:
        print("\n[CRITICAL] WSL not working. Linux-based engines (rDock, Gnina, LeDock) will fail.")

if __name__ == "__main__":
    main()
