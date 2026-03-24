from fastapi import APIRouter, Depends
from api.dependencies import get_config_manager
from core.docking_engine import DockingEngineFactory
import sys
import os

router = APIRouter()

@router.get("/engines")
def list_engines(config_manager = Depends(get_config_manager)):
    """List available docking engines and their status."""
    engines = DockingEngineFactory.get_available_engines()
    processed_engines = []
    
    for engine in engines:
        engine_copy = engine.copy()
        status = config_manager.get_executable_status(engine["id"])
        engine_copy["available"] = status["exists"] and status["functional"]
        engine_copy["path"] = config_manager.get_executable_path(engine["id"])
        if not engine_copy["available"]:
            engine_copy["error"] = status.get("error", "Executable not found or not functional")
        processed_engines.append(engine_copy)
        
    return processed_engines

@router.get("/info")
def system_info():
    """Get system information."""
    return {
        "platform": sys.platform,
        "python_version": sys.version,
        "cwd": os.getcwd()
    }
