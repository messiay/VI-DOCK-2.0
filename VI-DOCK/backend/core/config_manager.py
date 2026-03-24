import os
import json
import sys
import subprocess
from typing import Dict, Any, Optional
import shutil
import glob
from utils.paths import get_resource_path



class ConfigManager:
    """Manages application configuration from external files."""
    
    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self.config: Dict[str, Any] = {}
        self._default_config = self._get_default_config()
        self.load_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration as fallback."""
        return {
            "executables": {
                "obabel": "obabel",
                "vina": "vina",
                "smina": "smina",
                "gnina": "gnina",
                "qvina": "qvina",
                "ad4": "autodock4",
                "rdock": "rdock",
                "chimerax": "chimerax",
                "vmd": "vmd"
            },
            "platform_settings": {
                "windows": {
                    "obabel": "C:\\Program Files (x86)\\OpenBabel-3.1.1\\obabel.exe",
                    "vina": "C:\\Program Files (x86)\\PyRx\\vina.exe",
                    "smina": "smina.exe",
                    "gnina": "gnina.exe",
                    "qvina": "qvina.exe",
                    "ad4": "autodock4.exe",
                    "rdock": "rdock.exe",
                    "chimerax": "C:\\Program Files\\Chimerax 1.10.1\\bin\\Chimerax.exe",
                    "vmd": "C:\\Program Files\\University of Illinois\\UMD2\\vmd.exe",
                    "create_no_window": True
                },
                "linux": {
                    "obabel": "obabel",
                    "vina": "vina",
                    "chimerax": "chimerax",
                    "vmd": "vmd",
                    "create_no_window": False
                },
                "darwin": {
                    "obabel": "obabel",
                    "vina": "vina",
                    "ledock": "ledock",
                    "vina_gpu": "vina_gpu",
                    "plants": "plants",
                    "chimerax": "chimerax",
                    "vmd": "vmd",
                    "create_no_window": False
                }
            },
            "docking": {
                "default_exhaustiveness": 8,
                "default_refine_percentage": 10,
                "default_box_size": [25.0, 25.0, 25.0],
                "box_padding": 5.0,
                "adaptive_exhaustiveness_thresholds": [7, 12],
                "adaptive_exhaustiveness_values": [8, 16, 32]
            },
            "file_formats": {
                "supported_ligand_formats": [".pdb", ".sdf", ".mol2"],
                "supported_receptor_formats": [".pdb"]
            },
            "ui": {
                "default_mode": "Normal",
                "default_viewer": "VMD",
                "window_size": [1200, 800],
                "min_window_size": [1000, 700]
            },
            "network": {
                "pdb_download_url": "https://files.rcsb.org/download/{pdb_id}.pdb",
                "pubchem_base_url": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound",
                "timeout": 30
            },
            "temp": {
                "temp_dir_prefix": "vidock_",
                "cleanup_on_exit": True
            }
        }
    
    def load_config(self) -> bool:
        """Load configuration from file or create default if not exists."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    loaded_config = json.load(f)
                # Merge with defaults (loaded config overrides defaults)
                self.config = self._deep_merge(self._default_config, loaded_config)
                print(f"Configuration loaded from {self.config_file}")
            else:
                self.config = self._default_config.copy()
                self.save_config()  # Create default config file
                print(f"Default configuration created at {self.config_file}")
            return True
        except Exception as e:
            print(f"Error loading configuration: {e}. Using defaults.")
            self.config = self._default_config.copy()
            return False
    
    def _deep_merge(self, base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two dictionaries."""
        result = base.copy()
        for key, value in update.items():
            if (key in result and isinstance(result[key], dict) 
                and isinstance(value, dict)):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
    
    def get_platform_config(self) -> Dict[str, Any]:
        """Get platform-specific configuration."""
        platform = sys.platform
        platform_key = "windows" if platform == "win32" else platform
        return self.config["platform_settings"].get(platform_key, {})
    
    def get_executable_path(self, program: str) -> str:
        """Get executable path for a program."""
        
        # [PORTABILITY] 1. Priority: Check local ./bin folder relative to package
        try:
            # Assuming this file is in core/config_manager.py, root is one level up
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            local_bin = os.path.join(root_dir, 'bin', program)
            
            if sys.platform == 'win32' and not local_bin.endswith('.exe'):
                local_bin_exe = local_bin + '.exe'
                if os.path.exists(local_bin_exe):
                    return local_bin_exe
            
            if os.path.exists(local_bin):
                 return local_bin
                 
        except Exception:
            pass # Fallback if path manipulation fails
            
        platform_config = self.get_platform_config()
        
        # 2. Config file settings
        if program in platform_config:
            path = platform_config[program]
        else:
            path = self.config["executables"].get(program, program)
            
        # If path exists, return it
        if self._check_executable_exists(path):
            return path
            
        # If path doesn't exist and we are on Windows, try to detect it
        if sys.platform == 'win32':
            detected_path = self._detect_executable_path(program)
            if detected_path:
                return detected_path
        elif sys.platform.startswith('linux'):
             # On Linux, prioritize standard install locations
             # This fixes "Command not found" in Colab where PATH might be tricky
             standard_paths = [
                 f"/usr/bin/{program}",
                 f"/usr/local/bin/{program}",
                 f"/opt/{program}/bin/{program}"
             ]
             for p in standard_paths:
                 if os.path.exists(p):
                     return p # Return absolute path immediately
             
             # If not found in standard locations, try shutil.which
             which_path = shutil.which(program)
             if which_path:
                 return which_path
                 
             # Last resort: return program and hope it's in PATH
             return program

        return path
    
    def _detect_executable_path(self, program: str) -> Optional[str]:
        """Attempt to detect executable path on Windows."""
        if program == "chimerax":
            # Look in Program Files
            search_patterns = [
                r"C:\Program Files\ChimeraX*\bin\ChimeraX.exe",
                r"C:\Program Files\UCSF\ChimeraX*\bin\ChimeraX.exe",
                r"C:\Program Files (x86)\ChimeraX*\bin\ChimeraX.exe"
            ]
            for pattern in search_patterns:
                matches = glob.glob(pattern)
                if matches:
                    # Return the latest version if multiple found (sort by name usually works for versions)
                    return sorted(matches)[-1]
                    
        elif program == "vina":
            search_patterns = [
                r"C:\Program Files (x86)\PyRx\vina.exe",
                r"C:\Program Files\AutoDock Vina\vina.exe"
            ]
            for pattern in search_patterns:
                matches = glob.glob(pattern)
                if matches:
                    return matches[0]

            # Fallback: Check if smina is available and use it as vina (since it's compatible)
            smina_path = self.get_executable_path("smina")
            if smina_path and self._check_executable_exists(smina_path):
                return smina_path
                     
        elif program == "vmd":
            search_patterns = [
                r"C:\Program Files\University of Illinois\VMD*\vmd.exe",
                r"C:\Program Files (x86)\University of Illinois\VMD*\vmd.exe"
            ]
            for pattern in search_patterns:
                matches = glob.glob(pattern)
                if matches:
                    return sorted(matches)[-1]
                    
                if matches:
                    return sorted(matches)[-1]
                    
        elif program == "autodock_gpu":
            # Map autodock_gpu to vina_gpu.exe if not found as is
            bundled_bin = get_resource_path("bin")
            search_patterns = [
                os.path.join(bundled_bin, "vina_gpu.exe"),
                os.path.join(bundled_bin, "autodock_gpu.exe"),
                "vina_gpu.exe" # In check PATH
            ]
            for pattern in search_patterns:
                matches = glob.glob(pattern)
                if matches:
                    return matches[0]

        elif program in ["smina", "gnina", "qvina", "ad4", "rdock", "ledock", "vina_gpu", "plants", "autodock_gpu"]:
            # Generic search in common locations or bin folder
            # Use get_resource_path to find bundled binaries
            bundled_bin = get_resource_path("bin")
            
            search_patterns = [
                os.path.join(bundled_bin, f"{program}.bat"),  # Check for wrapper scripts first
                os.path.join(bundled_bin, f"{program}.exe"),
                os.path.join(bundled_bin, f"{program}_win32.exe"),
                os.path.join(bundled_bin, program, f"{program}.exe"), # Nested folder
                f"tools\\{program}.exe",
                f"C:\\Program Files\\{program}*\\{program}.exe",
                f"C:\\Program Files (x86)\\{program}*\\{program}.exe"
            ]
            
            # Specific check for LeDock
            if program == "ledock":
                search_patterns.insert(2, os.path.join(bundled_bin, "ledock", "LeDock.exe"))
                
            for pattern in search_patterns:
                matches = glob.glob(pattern)
                if matches:
                    return matches[0]
                    
        return None
    
    def get_docking_setting(self, key: str, default: Any = None) -> Any:
        """Get docking-specific setting."""
        return self.config["docking"].get(key, default)
    
    def get_ui_setting(self, key: str, default: Any = None) -> Any:
        """Get UI-specific setting."""
        return self.config["ui"].get(key, default)
    
    def get_file_formats(self, format_type: str) -> list:
        """Get supported file formats."""
        return self.config["file_formats"].get(format_type, [])
    
    def get_network_setting(self, key: str, default: Any = None) -> Any:
        """Get network-related setting."""
        return self.config["network"].get(key, default)
    
    def get_temp_setting(self, key: str, default: Any = None) -> Any:
        """Get temporary directory settings."""
        return self.config["temp"].get(key, default)
    
    def set_setting(self, category: str, key: str, value: Any) -> bool:
        """Update a configuration setting."""
        try:
            if category in self.config:
                self.config[category][key] = value
            else:
                self.config[category] = {key: value}
            return True
        except Exception as e:
            print(f"Error setting configuration: {e}")
            return False
    
    def validate_config(self) -> Dict[str, list]:
        """Validate configuration and return any issues."""
        issues = {}
        
        # Check if executables exist and are functional
        required_executables = ["obabel", "vina"]
        optional_executables = ["chimerax", "vmd"]
        
        for exe in required_executables + optional_executables:
            path = self.get_executable_path(exe)
            check_result = self._check_executable_functional(path, exe)
            
            if not check_result["exists"]:
                if exe in required_executables:
                    if "missing_executables" not in issues:
                        issues["missing_executables"] = []
                    issues["missing_executables"].append(f"{exe}: {path} (NOT FOUND)")
            elif not check_result["functional"]:
                if "non_functional_executables" not in issues:
                    issues["non_functional_executables"] = []
                issues["non_functional_executables"].append(f"{exe}: {path} ({check_result.get('error', 'Unknown error')})")
        
        # Validate docking settings
        docking_settings = self.config["docking"]
        if docking_settings["default_exhaustiveness"] <= 0:
            if "invalid_settings" not in issues:
                issues["invalid_settings"] = []
            issues["invalid_settings"].append("default_exhaustiveness must be positive")
        
        # Validate box sizes
        box_size = docking_settings["default_box_size"]
        if len(box_size) != 3 or any(s <= 0 for s in box_size):
            if "invalid_settings" not in issues:
                issues["invalid_settings"] = []
            issues["invalid_settings"].append("default_box_size must have 3 positive values")
        
        # Validate adaptive exhaustiveness settings
        thresholds = docking_settings.get("adaptive_exhaustiveness_thresholds", [])
        values = docking_settings.get("adaptive_exhaustiveness_values", [])
        if len(thresholds) + 1 != len(values):
            if "invalid_settings" not in issues:
                issues["invalid_settings"] = []
            issues["invalid_settings"].append("adaptive_exhaustiveness_thresholds and values length mismatch")
        
        return issues
    
    def _check_executable_functional(self, path: str, program: str) -> Dict[str, Any]:
        """Check if an executable exists and is functional."""
        result = {
            "exists": False,
            "functional": False,
            "error": None
        }
        
        # Check if executable exists
        if os.path.isabs(path):
            result["exists"] = os.path.exists(path)
        else:
            # Check if executable is in PATH
            result["exists"] = shutil.which(path) is not None
        
        if not result["exists"]:
            return result
        
        # Test if executable is functional
        try:
            if program == "obabel":
                cmd = [path, "-L", "formats"]
            elif program in ["vina"]:
                cmd = [path, "--help"]
            elif program in ["chimerax", "vmd"]:
                cmd = [path, "--version"]
            else:
                cmd = [path, "--help"]
            
            # Run test command
            process = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=10,  # 10 second timeout
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            
            result["functional"] = process.returncode == 0 or len(process.stdout) > 0
            if not result["functional"]:
                result["error"] = process.stderr[:100] if process.stderr else "No output produced"
                
        except subprocess.TimeoutExpired:
            result["functional"] = False
            result["error"] = "Command timed out"
        except Exception as e:
            result["functional"] = False
            result["error"] = str(e)
        
        return result
    
    def save_config(self) -> bool:
        """Save current configuration to file with backup."""
        try:
            # Create backup of existing config
            if os.path.exists(self.config_file):
                backup_file = self.config_file + '.backup'
                shutil.copy2(self.config_file, backup_file)
            
            # Save to temporary file first
            temp_file = self.config_file + '.tmp'
            with open(temp_file, 'w') as f:
                json.dump(self.config, f, indent=4)
            
            # Atomic replace
            if os.path.exists(self.config_file):
                os.remove(self.config_file)
            os.rename(temp_file, self.config_file)
            
            # Remove backup if save was successful
            if os.path.exists(self.config_file + '.backup'):
                os.remove(self.config_file + '.backup')
                
            return True
        except Exception as e:
            # Restore from backup if save failed
            if os.path.exists(self.config_file + '.backup'):
                try:
                    if os.path.exists(self.config_file):
                        os.remove(self.config_file)
                    os.rename(self.config_file + '.backup', self.config_file)
                except:
                    pass
            print(f"Error saving configuration: {e}")
            return False
    
    def create_config_wizard(self) -> bool:
        """Interactive configuration wizard for first-time setup."""
        try:
            print("=== VI DOCK Configuration Wizard ===")
            print("This wizard will help you configure the paths to required executables.")
            print("If you're not sure, you can press Enter to use the default values.")
            print()
            
            platform_config = self.get_platform_config()
            
            # Configure Open Babel
            current_obabel = platform_config.get("obabel", "obabel")
            new_obabel = input(f"Open Babel path [{current_obabel}]: ").strip()
            if new_obabel:
                self.set_setting("platform_settings", sys.platform, 
                               {**platform_config, "obabel": new_obabel})
            
            # Configure AutoDock Vina
            current_vina = platform_config.get("vina", "vina")
            new_vina = input(f"AutoDock Vina path [{current_vina}]: ").strip()
            if new_vina:
                self.set_setting("platform_settings", sys.platform,
                               {**platform_config, "vina": new_vina})
            
            # Configure ChimeraX
            current_chimerax = platform_config.get("chimerax", "chimerax")
            new_chimerax = input(f"ChimeraX path [{current_chimerax}]: ").strip()
            if new_chimerax:
                self.set_setting("platform_settings", sys.platform,
                               {**platform_config, "chimerax": new_chimerax})
            
            # Configure VMD
            current_vmd = platform_config.get("vmd", "vmd")
            new_vmd = input(f"VMD path [{current_vmd}]: ").strip()
            if new_vmd:
                self.set_setting("platform_settings", sys.platform,
                               {**platform_config, "vmd": new_vmd})
            
            # Save configuration
            if self.save_config():
                print(f"\nConfiguration saved to {self.config_file}")
                
                # Validate configuration
                issues = self.validate_config()
                if issues:
                    print("\nConfiguration issues found:")
                    for category, problems in issues.items():
                        print(f"  {category}:")
                        for problem in problems:
                            print(f"    - {problem}")
                else:
                    print("Configuration validated successfully!")
                
                return True
            else:
                print("Failed to save configuration.")
                return False
                
        except Exception as e:
            print(f"Error in configuration wizard: {e}")
            return False
    
    def _check_executable_exists(self, path: str) -> bool:
        """Check if an executable exists."""
        if os.path.isabs(path):
            return os.path.exists(path)
        else:
            # Check if executable is in PATH
            return shutil.which(path) is not None
    
    def get_executable_status(self, program: str) -> Dict[str, Any]:
        """Get detailed status of an executable."""
        path = self.get_executable_path(program)
        return self._check_executable_functional(path, program)
    
    def get_all_executable_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all executables."""
        status = {}
        executables = ["obabel", "vina", "chimerax", "vmd"]
        
        for exe in executables:
            status[exe] = self.get_executable_status(exe)
        
        return status