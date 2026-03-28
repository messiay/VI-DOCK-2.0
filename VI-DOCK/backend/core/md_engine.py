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

class ProgressReporter:
    def __init__(self, callback, reportInterval):
        self._callback = callback
        self._reportInterval = reportInterval

    def describeNextReport(self, simulation):
        steps = self._reportInterval - simulation.currentStep % self._reportInterval
        return (steps, True, False, False, True, False)

    def report(self, simulation, state):
        steps = simulation.currentStep
        energy = state.getPotentialEnergy().value_in_unit(unit.kilocalories_per_mole)
        msg = f"Step {steps} | Energy: {energy:.2f} kcal/mol"
        self._callback(msg)

class MDEngine:
    """
    Molecular Dynamics Engine using OpenMM.
    Provides methods for system preparation, minimization, and simulation.
    """
    
    def __init__(self, working_dir: str = None, status_callback: callable = None):
        self.working_dir = Path(working_dir) if working_dir else Path("md_temp")
        self.working_dir.mkdir(exist_ok=True, parents=True)
        self.status_callback = status_callback
        self.simulation = None

    def _log(self, message: str):
        print(f"DEBUG: {message}")
        if self.status_callback:
            self.status_callback(message)
        
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
            self._log(f"Preparing system for: {os.path.basename(pdb_path)}")
            
            # --- pre-clean PDB of malformed waters ---
            with open(pdb_path, 'r') as f:
                lines = f.readlines()
            clean_pdb_path = str(self.working_dir / "cleaned_input.pdb")
            with open(clean_pdb_path, 'w') as f:
                for line in lines:
                    if line.startswith("HETATM") or line.startswith("ATOM"):
                        if "HOH" in line or "WAT" in line:
                            continue
                    f.write(line)
            
            # 1. Fix PDB
            fixer = PDBFixer(filename=clean_pdb_path)
            
            self._log("Fixing missing atoms and residues...")
            fixer.findMissingResidues()
            fixer.findNonstandardResidues()
            fixer.replaceNonstandardResidues()
            fixer.findMissingAtoms()
            fixer.addMissingAtoms()
            
            self._log("Adding missing hydrogens (pH 7.0)...")
            fixer.addMissingHydrogens(7.0) # pH 7.0
            
            # 2. Setup Forcefield
            self._log(f"Loading Forcefield: {forcefield}")
            if water_model:
                ff = ForceField(forcefield, water_model)
            else:
                ff = ForceField(forcefield)
            
            # 3. Create Modeller
            modeller = Modeller(fixer.topology, fixer.positions)
            
            # 4. Solvate
            if solvate:
                self._log("Cleaning existing water and solvating...")
                modeller.deleteWater() # Always remove existing water to avoid template issues
                modeller.addSolvent(ff, padding=1.0*unit.nanometer, ionicStrength=0.15*unit.molar)
            
            # 5. Save prepared system
            prepared_pdb = self.working_dir / "prepared_system.pdb"
            with open(prepared_pdb, "w") as f:
                PDBFile.writeFile(modeller.topology, modeller.positions, f)
            
            self._log("System preparation complete.")
            return {
                "success": True, 
                "topology": modeller.topology,
                "positions": modeller.positions,
                "forcefield": ff,
                "prepared_pdb": str(prepared_pdb)
            }
        except Exception as e:
            self._log(f"Preparation Failed: {str(e)}")
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
            self._log("Creating OpenMM System object...")
            system = forcefield.createSystem(topology, 
                                             nonbondedMethod=app.PME, 
                                             nonbondedCutoff=1.0*unit.nanometer,
                                             constraints=app.HBonds)
            
            # 2. Setup Integrator
            integrator = LangevinMiddleIntegrator(temp_k*kelvin, 1/picosecond, step_size_fs*unit.femtoseconds)
            
            # 3. Setup Simulation and Platform Selection
            from openmm import Platform
            platform = None
            for p_name in ['CUDA', 'OpenCL', 'CPU']:
                try:
                    platform = Platform.getPlatformByName(p_name)
                    self._log(f"Selected Platform: {p_name}")
                    break
                except Exception:
                    pass
            
            if platform:
                simulation = Simulation(topology, system, integrator, platform)
                self._log(f"Selected Platform: {platform.getName()}")
            else:
                simulation = Simulation(topology, system, integrator)
                self._log(f"Selected Platform: {simulation.context.getPlatform().getName()}")
            
            simulation.context.setPositions(positions)
            
            # 4. Minimize
            if minimize:
                self._log("Running Energy Minimization (Max 500 steps to prevent hanging)...")
                simulation.minimizeEnergy(maxIterations=500)
                self._log("Minimization Complete.")
                
            # 5. Reporters
            dcd_path = self.working_dir / f"{output_prefix}.dcd"
            pdb_path = self.working_dir / f"{output_prefix}_final.pdb"
            log_path = self.working_dir / f"{output_prefix}.log"
            
            simulation.reporters.append(DCDReporter(str(dcd_path), report_interval))
            simulation.reporters.append(app.StateDataReporter(str(log_path), report_interval, 
                                                            step=True, potentialEnergy=True, 
                                                            temperature=True))
            
            # Live Console Reporter
            if self.status_callback:
                simulation.reporters.append(ProgressReporter(self.status_callback, report_interval))
            
            # 6. Production Run
            self._log(f"Starting Production MD ({total_steps} steps)...")
            simulation.step(total_steps)
            
            # 7. Save Final State
            state = simulation.context.getState(getPositions=True)
            with open(pdb_path, "w") as f:
                PDBFile.writeFile(topology, state.getPositions(), f)
            
            self._log("Simulation Complete.")
            return {
                "success": True,
                "dcd": str(dcd_path),
                "final_pdb": str(pdb_path),
                "log": str(log_path)
            }
        except Exception as e:
            self._log(f"Simulation Failed: {str(e)}")
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
