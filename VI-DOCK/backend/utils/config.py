import os
import sys
import subprocess
from typing import Optional

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from core.config_manager import ConfigManager

# Global config manager instance
_config_manager: Optional[ConfigManager] = None

def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager

# Initialize configuration manager
_config_manager = get_config_manager()

# Platform-specific settings for silent execution
CREATE_NO_WINDOW = 0
if sys.platform == 'win32':
    platform_config = _config_manager.get_platform_config()
    if platform_config.get("create_no_window", True):
        CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW

# Alternative platform-specific flags (for compatibility)
if os.name == 'nt':  # Windows
    CREATE_NO_WINDOW_FLAG = 0x08000000
else:
    CREATE_NO_WINDOW_FLAG = 0

# Application constants - now loaded from configuration
SUPPORTED_LIGAND_FORMATS = tuple(_config_manager.get_file_formats("supported_ligand_formats"))
SUPPORTED_RECEPTOR_FORMATS = tuple(_config_manager.get_file_formats("supported_receptor_formats"))
DEFAULT_EXHAUSTIVENESS = _config_manager.get_docking_setting("default_exhaustiveness", 8)
DEFAULT_REFINE_PERCENTAGE = _config_manager.get_docking_setting("default_refine_percentage", 10)
DEFAULT_BOX_SIZE = tuple(_config_manager.get_docking_setting("default_box_size", (25.0, 25.0, 25.0)))
BOX_PADDING = _config_manager.get_docking_setting("box_padding", 5.0)

# Executable paths - loaded from configuration (only essential ones kept)
OBABEL_PATH = _config_manager.get_executable_path("obabel")
VINA_PATH = _config_manager.get_executable_path("vina")
SMINA_PATH = _config_manager.get_executable_path("smina")
GNINA_PATH = _config_manager.get_executable_path("gnina")
QVINA_PATH = _config_manager.get_executable_path("qvina")
AD4_PATH = _config_manager.get_executable_path("ad4")
RDOCK_PATH = _config_manager.get_executable_path("rdock")
CHIMERAX_PATH = _config_manager.get_executable_path("chimerax")
VMD_PATH = _config_manager.get_executable_path("vmd")

# Network settings
PDB_DOWNLOAD_URL = _config_manager.get_network_setting("pdb_download_url")
PUBCHEM_BASE_URL = _config_manager.get_network_setting("pubchem_base_url")
NETWORK_TIMEOUT = _config_manager.get_network_setting("timeout", 30)

# UI settings
DEFAULT_MODE = _config_manager.get_ui_setting("default_mode", "Normal")
DEFAULT_VIEWER = _config_manager.get_ui_setting("default_viewer", "VMD")
WINDOW_SIZE = tuple(_config_manager.get_ui_setting("window_size", (800, 750)))
MIN_WINDOW_SIZE = tuple(_config_manager.get_ui_setting("min_window_size", (750, 700)))

# Temporary directory settings
TEMP_DIR_PREFIX = _config_manager.get_temp_setting("temp_dir_prefix", "vidock_")
CLEANUP_ON_EXIT = _config_manager.get_temp_setting("cleanup_on_exit", True)

# Configuration management functions
def validate_configuration() -> bool:
    """Validate the current configuration."""
    issues = _config_manager.validate_config()
    if issues:
        print("Configuration issues found:")
        for category, problems in issues.items():
            print(f"  {category}:")
            for problem in problems:
                print(f"    - {problem}")
        return False
    return True

def run_configuration_wizard() -> bool:
    """Run the configuration wizard."""
    return _config_manager.create_config_wizard()

def reload_configuration() -> bool:
    """Reload configuration from file."""
    return _config_manager.load_config()

def save_configuration() -> bool:
    """Save current configuration to file."""
    return _config_manager.save_config()