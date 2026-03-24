from fastapi import APIRouter, Depends
from api.dependencies import get_config_manager
from core.docking_engine import DockingEngineFactory
import sys
import os

router = APIRouter()

@router.get("/engines")
def list_engines():
    """List available docking engines and their status."""
    engines = DockingEngineFactory.get_available_engines()
    # Add status check?
    return engines

@router.get("/info")
def system_info():
    """Get system information."""
    return {
        "platform": sys.platform,
        "python_version": sys.version,
        "cwd": os.getcwd()
    }
