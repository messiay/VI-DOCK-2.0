from functools import lru_cache
from pathlib import Path
from typing import Optional
from core.project_manager import ProjectManager
from utils.config import ConfigManager

PROJECTS_ROOT = Path("VI DOCK_Projects").resolve()
PROJECTS_ROOT.mkdir(exist_ok=True)

@lru_cache()
def get_project_manager():
    return ProjectManager()

@lru_cache()
def get_config_manager():
    return ConfigManager()

def find_project_path(project_name: str) -> Optional[Path]:
    """Find a project folder by name prefix."""
    for item in PROJECTS_ROOT.iterdir():
        if item.is_dir() and item.name.startswith(f"{project_name}_"):
             return item
    return None
