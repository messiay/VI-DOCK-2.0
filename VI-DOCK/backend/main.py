import sys
import os
import tkinter as tk
from pathlib import Path
import multiprocessing
import traceback

# Add current directory to path if needed (for dev mode)
if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    if str(current_dir) not in sys.path:
        sys.path.append(str(current_dir))

# Top-level imports to ensure PyInstaller detects them
from core.logger import setup_logging
from gui.main_window import MainWindow
from installer_logic import DependencyInstaller, InstallerDialog
from utils.config import get_config_manager

def main():
    """Main entry point for VI DOCK 3.1"""
    # Required for PyInstaller with multiprocessing
    multiprocessing.freeze_support()
    
    try:
        # Initialize logging
        setup_logging()
        
        print("Starting VI DOCK 3.1...")
        print("Available docking engines will be detected automatically.")
        
        # Check for dependencies
        installer = DependencyInstaller()
        missing = installer.check_dependencies()
        
        if missing:
            root = tk.Tk()
            root.withdraw() # Hide main window
            
            # Show confirmation
            msg = f"The following components are missing: {', '.join(missing)}.\n\nVI DOCK can download and install them automatically.\nDo you want to proceed?"
            if tk.messagebox.askyesno("First Time Setup", msg):
                dlg = InstallerDialog(root, installer, missing)
                root.wait_window(dlg)
                
                # Re-check after install
                # Force config reload to detect new paths
                from utils.config import get_config_manager
                get_config_manager().load_config()
            
            root.destroy()

        app = MainWindow()
        app.run()
        
    except Exception as e:
        error_msg = f"Failed to start VI DOCK: {e}\n\n{traceback.format_exc()}"
        print(error_msg)
        try:
            tk.messagebox.showerror("Startup Error", error_msg)
        except:
            pass # If tk failed to init, we can't show message box

if __name__ == "__main__":
    main()
