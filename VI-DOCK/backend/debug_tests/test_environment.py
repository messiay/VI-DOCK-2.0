
import os
import sys
import importlib
import warnings

warnings.filterwarnings("ignore")

print("=== VI DOCK Pro Backend Connectivity Test ===")
print(f"Python: {sys.version}")

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_path)

modules_to_test = [
    ("FastAPI", "fastapi"),
    ("Uvicorn", "uvicorn"),
    ("OpenBabel (if installed)", "openbabel"),
    ("RDKit (if installed)", "rdkit"),
    ("Meeko (if installed)", "meeko"),
    ("Core Config", "core.config_manager"),
    ("Docking Engine", "core.docking_engine"),
    ("Project Manager", "core.project_manager"),
]

for name, module in modules_to_test:
    try:
        importlib.import_module(module)
        print(f"✅ {name}: Loaded successfully")
    except ImportError as e:
        print(f"❌ {name}: Failed to import ({e})")
    except Exception as e:
        print(f"❌ {name}: Error ({e})")

print("\n=== Initializing Config Manager ===")
try:
    from core.config_manager import ConfigManager
    cm = ConfigManager()
    print("✅ Config Manager Initialized")
    print(f"   Config Path: {cm.config_path}")
    
    issues = cm.validate_config()
    if issues:
        print("⚠️ Configuration Issues Found:")
        for cat, prob in issues.items():
            print(f"   - {cat}: {prob}")
    else:
        print("✅ Configuration is Valid")

except Exception as e:
    print(f"❌ Config Manager Failed: {e}")

print("\n=== Test Completed ===")
