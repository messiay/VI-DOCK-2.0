import sys
import os

def get_resource_path(relative_path: str) -> str:
    """
    Get absolute path to resource, works for dev and for PyInstaller.
    
    Args:
        relative_path: Path relative to the application root (e.g., 'bin/vina.exe')
        
    Returns:
        Absolute path to the resource
    """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        # Normal python process, look relative to current working directory
        # or the script directory if we want to be safer
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)
