from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from api.models import MDConfig, MDJobResponse
from api.dependencies import get_project_manager, get_config_manager
from core.md_engine import MDEngine
import uuid
import os
from pathlib import Path
from typing import Dict

router = APIRouter()

# In-memory job store (should be persistent in production)
md_jobs: Dict[str, dict] = {}

def run_md_task(job_id: str, config: MDConfig, project_path: str):
    """Background task wrapper for Molecular Dynamics."""
    print(f"DEBUG: Starting MD task {job_id}...")
    try:
        md_jobs[job_id]["status"] = "running"
        md_jobs[job_id]["progress_log"] = "Job initialized..."
        
        def status_cb(msg):
            md_jobs[job_id]["progress_log"] = msg

        project_path_obj = Path(project_path)
        
        # 1. Resolve PDB Path
        pdb_name = Path(config.pdb_file).name
        # Check standard locations
        potential_paths = [
            project_path_obj / config.pdb_file,
            project_path_obj / "results" / pdb_name,
            project_path_obj / "receptors" / pdb_name,
            project_path_obj / pdb_name
        ]
        
        pdb_path = None
        for p in potential_paths:
            if p.exists():
                pdb_path = str(p)
                break
        
        if not pdb_path:
            raise FileNotFoundError(f"PDB file '{config.pdb_file}' not found in project.")

        # 2. Setup Working Directory
        md_dir = project_path_obj / "md_simulations" / job_id
        md_dir.mkdir(exist_ok=True, parents=True)
        
        # 3. Initialize Engine
        engine = MDEngine(working_dir=str(md_dir), status_callback=status_cb)
        
        # 4. Prepare System
        prep_res = engine.prepare_system(
            pdb_path,
            forcefield=config.forcefield,
            water_model=config.water_model,
            solvate=config.solvate,
            add_ions=config.add_ions
        )
        
        if not prep_res["success"]:
            raise Exception(f"System preparation failed: {prep_res.get('error')}")

        # 5. Run Simulation
        print(f"DEBUG: Running simulation for {job_id}...")
        # Calculate steps: time_ns * 1000 ps/ns / step_size_ps
        # Let's assume constant 2fs step size for now
        step_size_fs = 2.0
        total_steps = int((config.simulation_time_ns * 1000 * 1000) / step_size_fs)
        report_interval = int((config.report_interval_ps * 1000) / step_size_fs)
        
        sim_res = engine.run_simulation(
            prep_res["topology"],
            prep_res["positions"],
            prep_res["forcefield"],
            output_prefix="md_run",
            temp_k=config.temp_k,
            step_size_fs=step_size_fs,
            total_steps=total_steps,
            report_interval=report_interval,
            minimize=config.minimize
        )
        
        if sim_res["success"]:
            md_jobs[job_id]["status"] = "completed"
            md_jobs[job_id]["files"] = {
                "dcd": os.path.relpath(sim_res["dcd"], project_path),
                "final_pdb": os.path.relpath(sim_res["final_pdb"], project_path),
                "log": os.path.relpath(sim_res["log"], project_path),
                "prepared_pdb": os.path.relpath(prep_res["prepared_pdb"], project_path)
            }
        else:
            md_jobs[job_id]["status"] = "failed"
            md_jobs[job_id]["error"] = sim_res.get("error")
            
    except Exception as e:
        print(f"CRITICAL ERROR in MD task {job_id}: {e}")
        import traceback
        traceback.print_exc()
        md_jobs[job_id]["status"] = "failed"
        md_jobs[job_id]["error"] = str(e)

@router.post("/{project_name}/run", response_model=MDJobResponse)
def submit_md_job(
    project_name: str,
    config: MDConfig,
    background_tasks: BackgroundTasks,
    pm = Depends(get_project_manager)
):
    """Submit a Molecular Dynamics job."""
    from api.dependencies import find_project_path
    
    project_path = find_project_path(project_name)
    if not project_path or not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
        
    job_id = str(uuid.uuid4())
    md_jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "project_name": project_name
    }
    
    background_tasks.add_task(run_md_task, job_id, config, str(project_path))
    
    return MDJobResponse(
        job_id=job_id,
        status="pending",
        project_name=project_name
    )

@router.get("/jobs/{job_id}")
def get_md_job_status(job_id: str):
    """Get status of a specific MD job."""
    if job_id not in md_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return md_jobs[job_id]

@router.get("/jobs/{job_id}/log")
def get_md_job_log(job_id: str, pm = Depends(get_project_manager)):
    """Fetch parsed MD simulation log data."""
    if job_id not in md_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = md_jobs[job_id]
    if job.get("status") != "completed" and "files" not in job:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    from api.dependencies import find_project_path
    project_path = find_project_path(job["project_name"])
    if not project_path:
        raise HTTPException(status_code=404, detail="Project not found")

    log_rel_path = job["files"].get("log")
    if not log_rel_path:
        raise HTTPException(status_code=404, detail="Log file missing from job data")

    log_path = project_path / log_rel_path
    if not log_path.exists():
        raise HTTPException(status_code=404, detail=f"Log file not found on disk: {log_path}")

    # Parse OpenMM StateDataReporter CSV
    import csv
    data = []
    try:
        with open(log_path, 'r') as f:
            # Skip comments/header prefix if needed (OpenMM starts with #)
            lines = f.readlines()
            # Clean up the # prefix from header
            if lines and lines[0].startswith('#"'):
                lines[0] = lines[0].replace('#"', '"').replace('",#', '",')
            elif lines and lines[0].startswith('#Step'):
                lines[0] = lines[0].replace('#Step', 'Step')
            
            reader = csv.DictReader(lines)
            for row in reader:
                # Convert values to numbers
                clean_row = {}
                for k, v in row.items():
                    try:
                        clean_row[k.strip('#" ')] = float(v)
                    except:
                        clean_row[k.strip('#" ')] = v
                data.append(clean_row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse log: {str(e)}")

    return {"data": data}

@router.get("/jobs")
def list_md_jobs():
    """List all MD jobs."""
    return list(md_jobs.values())
