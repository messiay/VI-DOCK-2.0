import os
import time
import traceback
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

# OpenMM imports (will be installed)
try:
    from openmm import app, unit, LangevinMiddleIntegrator, Vec3
    from openmm.app import PDBFile, ForceField, Simulation, PDBReporter, DCDReporter, Modeller
    from openmm.unit import kelvin, picosecond, nanometer, bar, atmospheres
    from pdbfixer import PDBFixer
    OPENMM_AVAILABLE = True
except ImportError:
    OPENMM_AVAILABLE = False

class MDEngine:
    """
    Molecular Dynamics Engine using OpenMM.
    Provides methods for system preparation, minimization, and simulation.
    """
    
    def __init__(self, working_dir: str = None):
        self.working_dir = Path(working_dir) if working_dir else Path("md_temp")
        self.working_dir.mkdir(exist_ok=True, parents=True)
        self.simulation = None
        
    def check_availability(self) -> Dict[str, Any]:
        """Check if OpenMM and dependencies are installed."""
        return {
            "available": OPENMM_AVAILABLE,
            "error": "OpenMM or PDBFixer not installed. Please run setup." if not OPENMM_AVAILABLE else None
        }

    def prepare_system(self, 
                       pdb_path: str, 
                       forcefield: str = 'amber14-all.xml', 
                       water_model: str = None, # Default to None as amber14-all includes TIP3P
                       solvate: bool = True,
                       add_ions: bool = True) -> Dict[str, Any]:
        """
        Prepare the system: Fix PDB, add hydrogens, solvate, and add ions.
        """
        if not OPENMM_AVAILABLE:
            return {"success": False, "error": "OpenMM not installed"}
            
        try:
            print(f"DEBUG: Preparing system with FF: {forcefield}, Water: {water_model}")
            # 1. Fix PDB
            fixer = PDBFixer(filename=pdb_path)
            fixer.findMissingResidues()
            fixer.findNonstandardResidues()
            fixer.replaceNonstandardResidues()
            fixer.findMissingAtoms()
            fixer.addMissingAtoms()
            fixer.addMissingHydrogens(7.0) # pH 7.0
            
            # 2. Setup Forcefield
            if water_model:
                ff = ForceField(forcefield, water_model)
            else:
                ff = ForceField(forcefield)
            
            # 3. Create Modeller
            modeller = Modeller(fixer.topology, fixer.positions)
            
            # 4. Solvate
            if solvate:
                modeller.addSolvent(ff, padding=1.0*unit.nanometer, ionicStrength=0.15*unit.molar)
            
            # 5. Save prepared system
            prepared_pdb = self.working_dir / "prepared_system.pdb"
            with open(prepared_pdb, "w") as f:
                PDBFile.writeFile(modeller.topology, modeller.positions, f)
                
            return {
                "success": True, 
                "topology": modeller.topology,
                "positions": modeller.positions,
                "forcefield": ff,
                "prepared_pdb": str(prepared_pdb)
            }
        except Exception as e:
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

    def run_simulation(self,
                       topology,
                       positions,
                       forcefield,
                       output_prefix: str = "output",
                       temp_k: float = 300,
                       step_size_fs: float = 2.0,
                       total_steps: int = 5000,
                       report_interval: int = 500,
                       minimize: bool = True) -> Dict[str, Any]:
        """
        Run energy minimization and MD simulation.
        """
        try:
            # 1. Create System
            system = forcefield.createSystem(topology, 
                                             nonbondedMethod=app.PME, 
                                             nonbondedCutoff=1.0*unit.nanometer,
                                             constraints=app.HBonds)
            
            # 2. Setup Integrator
            integrator = LangevinMiddleIntegrator(temp_k*kelvin, 1/picosecond, step_size_fs*unit.femtoseconds)
            
            # 3. Setup Simulation
            simulation = Simulation(topology, system, integrator)
            simulation.context.setPositions(positions)
            
            # 4. Minimize
            if minimize:
                simulation.minimizeEnergy()
                
            # 5. Reporters
            dcd_path = self.working_dir / f"{output_prefix}.dcd"
            pdb_path = self.working_dir / f"{output_prefix}_final.pdb"
            log_path = self.working_dir / f"{output_prefix}.log"
            
            simulation.reporters.append(DCDReporter(str(dcd_path), report_interval))
            simulation.reporters.append(app.StateDataReporter(str(log_path), report_interval, 
                                                            step=True, potentialEnergy=True, 
                                                            temperature=True))
            
            # 6. Production Run
            simulation.step(total_steps)
            
            # 7. Save Final State
            state = simulation.context.getState(getPositions=True)
            with open(pdb_path, "w") as f:
                PDBFile.writeFile(topology, state.getPositions(), f)
                
            return {
                "success": True,
                "dcd": str(dcd_path),
                "final_pdb": str(pdb_path),
                "log": str(log_path)
            }
        except Exception as e:
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
