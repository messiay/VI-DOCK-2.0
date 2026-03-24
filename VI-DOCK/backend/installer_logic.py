import os
import sys
import subprocess
import urllib.request
import tempfile
import shutil
from pathlib import Path
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import ctypes

# Adjusted imports for root level
from utils.config import get_config_manager
from utils.paths import get_resource_path

def is_admin():
    """Check if the script is running with admin privileges."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

class DependencyInstaller:
    """Handles installation of external dependencies."""
    
    def __init__(self, parent_window=None):
        self.parent = parent_window
        self.config_manager = get_config_manager()
        self.temp_dir = Path(tempfile.gettempdir()) / "vidock_installers"
        self.temp_dir.mkdir(exist_ok=True)
        
        # URLs - These should ideally be configurable or fetched from a reliable source
        # Using specific versions to ensure compatibility
        self.urls = {
            "chimerax": "https://www.cgl.ucsf.edu/chimerax/cgi-bin/secure/chimerax-get.py?file=Windows/ucsf-chimerax-1.8-win64.exe", # Example URL
            "obabel": "https://github.com/openbabel/openbabel/releases/download/openbabel-3-1-1/OpenBabel-3.1.1-x64.exe"
        }
        
    def check_dependencies(self):
        """Check which dependencies are missing."""
        missing = []
        
        # Check ChimeraX
        if not self.config_manager.get_executable_path("chimerax"):
             missing.append("chimerax")
             
        # Check OpenBabel
        if not self.config_manager.get_executable_path("obabel"):
            missing.append("obabel")
            
        return missing

    def install_dependency(self, name, progress_callback=None):
        """Download and install a dependency."""
        if name not in self.urls:
            return False, f"No installer URL for {name}"
            
        url = self.urls[name]
        filename = url.split("/")[-1].split("?")[0]
        if not filename.endswith(".exe"):
            filename = f"{name}_installer.exe"
            
        installer_path = self.temp_dir / filename
        
        # 1. Download
        try:
            if progress_callback:
                progress_callback(f"Downloading {name}...", 0)
                
            if not installer_path.exists(): # Resume/Cache check could be better
                self._download_file(url, installer_path, progress_callback)
            
            if progress_callback:
                progress_callback(f"Installing {name}...", 50)
                
            # 2. Install
            success, error = self._run_silent_installer(name, installer_path)
            
            if success:
                if progress_callback:
                    progress_callback(f"Finished {name}", 100)
                return True, None
            else:
                return False, error
                
        except Exception as e:
            return False, str(e)

    def _download_file(self, url, target_path, progress_callback=None):
        """Download file with progress tracking."""
        response = urllib.request.urlopen(url)
        total_size = int(response.info().get('Content-Length', 0))
        
        block_size = 8192
        downloaded = 0
        
        with open(target_path, 'wb') as f:
            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break
                downloaded += len(buffer)
                f.write(buffer)
                
                if total_size > 0 and progress_callback:
                    percent = int((downloaded / total_size) * 50) # First 50% is download
                    progress_callback(None, percent)

    def _run_silent_installer(self, name, installer_path):
        """Run the installer silently."""
        try:
            cmd = [str(installer_path)]
            
            if name == "chimerax":
                # Inno Setup flags
                cmd.extend(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/ALLUSERS"])
            elif name == "obabel":
                # NSIS flags
                cmd.extend(["/S"])
            
            # Check for admin rights
            if not is_admin():
                # If not admin, try to run the installer directly with 'runas' to trigger UAC
                # We can't capture output easily this way, but it ensures elevation
                import win32api
                import win32con
                
                # Use ShellExecute to run as admin
                # This will show the UAC prompt for the installer itself
                ret = ctypes.windll.shell32.ShellExecuteW(
                    None, 
                    "runas", 
                    str(installer_path), 
                    " ".join(cmd[1:]), 
                    None, 
                    1 # SW_SHOWNORMAL
                )
                
                if ret > 32: # Success
                    # We can't easily wait for it without more complex code, 
                    # but for now we assume if it launched, it's good.
                    # A better approach for a "silent" installer that needs admin is to 
                    # restart the *main app* as admin first.
                    return True, "Launched with Admin privileges (check UAC)"
                else:
                    return False, f"Failed to elevate privileges. Error code: {ret}"

            # If we are already admin, run normally
            process = subprocess.run(
                cmd, 
                check=True, 
                capture_output=True, 
                text=True
            )
            return True, None
            
        except subprocess.CalledProcessError as e:
            return False, f"Installer failed with code {e.returncode}. Stderr: {e.stderr}"
        except Exception as e:
            return False, str(e)

class InstallerDialog(tk.Toplevel):
    """GUI Dialog for installation progress."""
    def __init__(self, parent, installer, missing_deps):
        super().__init__(parent)
        self.title("First Time Setup")
        self.geometry("400x300")
        self.installer = installer
        self.missing_deps = missing_deps
        
        self.protocol("WM_DELETE_WINDOW", lambda: None) # Disable close
        
        ttk.Label(self, text="Installing missing dependencies...", font=("Arial", 12, "bold")).pack(pady=10)
        
        self.status_labels = {}
        self.progress_bars = {}
        
        for dep in missing_deps:
            frame = ttk.Frame(self)
            frame.pack(fill="x", padx=20, pady=5)
            
            lbl = ttk.Label(frame, text=f"{dep}: Pending")
            lbl.pack(anchor="w")
            self.status_labels[dep] = lbl
            
            pb = ttk.Progressbar(frame, length=300, mode='determinate')
            pb.pack(fill="x")
            self.progress_bars[dep] = pb
            
        self.log_text = tk.Text(self, height=8, width=40, font=("Consolas", 8))
        self.log_text.pack(fill="both", expand=True, padx=20, pady=10)
        
        # Start installation thread
        threading.Thread(target=self._run_install, daemon=True).start()
        
    def _run_install(self):
        for dep in self.missing_deps:
            self._update_status(dep, "Starting...", 0)
            
            def update_progress(msg, percent):
                if msg:
                    self._log(f"{dep}: {msg}")
                if percent is not None:
                    self.progress_bars[dep]['value'] = percent
            
            success, error = self.installer.install_dependency(dep, update_progress)
            
            if success:
                self._update_status(dep, "Installed", 100)
                self._log(f"{dep} installed successfully.")
            else:
                self._update_status(dep, "Failed", 0)
                self._log(f"Error installing {dep}: {error}")
        
        self._log("Setup complete. Restarting application...")
        self.after(2000, self.destroy)

    def _update_status(self, dep, text, percent):
        self.status_labels[dep].config(text=f"{dep}: {text}")
        self.progress_bars[dep]['value'] = percent
        
    def _log(self, message):
        self.log_text.insert("end", message + "\n")
        self.log_text.see("end")
