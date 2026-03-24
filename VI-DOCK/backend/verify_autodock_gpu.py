import sys
import os
sys.path.append(os.getcwd())

from core.docking_engine import DockingEngineFactory
from core.docking_manager import DockingManager

def test_autodock_gpu_integration():
    print("Testing AutoDock-GPU Integration...")
    
    # 1. Test Factory
    try:
        engine = DockingEngineFactory.create_engine("autodock_gpu")
        print(f"[OK] Factory created engine: {engine.get_name()}")
    except Exception as e:
        print(f"[FAIL] Factory creation failed: {e}")
        return

    # 2. Test Command Generation
    try:
        cmd = engine._build_command(
            receptor="protein.pdbqt",
            ligand="ligand.pdbqt",
            out="output.pdbqt",
            center=(10.0, 10.0, 10.0),
            size=(20.0, 20.0, 20.0),
            exhaustiveness=32,
            kwargs={'seed': 12345}
        )
        print(f"[OK] Command generated: {' '.join(cmd)}")
        
        # Verify specific flags
        if "--exhaustiveness" in cmd and "32" in cmd:
            print("[OK] Exhaustiveness flag present")
        else:
            print("[FAIL] Exhaustiveness flag missing or incorrect")
            
    except Exception as e:
        print(f"[FAIL] Command generation failed: {e}")

    # 3. Test Manager Availability
    manager = DockingManager()
    engines = manager.get_available_engines()
    if "autodock_gpu" in engines:
        print(f"[OK] AutoDock-GPU listed in Manager: {engines}")
    else:
        print(f"[FAIL] AutoDock-GPU NOT in Manager. Found: {engines}")

if __name__ == "__main__":
    test_autodock_gpu_integration()
