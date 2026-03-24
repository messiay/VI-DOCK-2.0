from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import List
import os
import shutil
from pathlib import Path
from api.models import ProjectCreate, ProjectResponse
from api.dependencies import get_project_manager
from core.project_manager import ProjectBrowser # Import ProjectBrowser

router = APIRouter()

# Default base directory for projects
PROJECTS_ROOT = Path("VI DOCK_Projects").resolve()
PROJECTS_ROOT.mkdir(exist_ok=True)

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, pm = Depends(get_project_manager)):
    """Create a new project folder."""
    try:
        # PM.create_new_project returns the path string
        # Signature: create_new_project(project_name: str, base_directory: Union[str, Path])
        path_str = pm.create_new_project(project.name, PROJECTS_ROOT)
        return ProjectResponse(
            name=project.name,
            path=path_str,
            files=[]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[dict])
def list_projects():
    """List all available projects."""
    # Use ProjectBrowser for listing
    return ProjectBrowser.list_projects(PROJECTS_ROOT)

@router.get("/{project_name}", response_model=ProjectResponse)
def get_project(project_name: str, pm = Depends(get_project_manager)):
    """Get project details and files."""
    from api.dependencies import find_project_path
    
    found_path = find_project_path(project_name)
    if not found_path:
         raise HTTPException(status_code=404, detail="Project not found")
    
    # Load project to get details
    try:
        data = pm.load_project(found_path)
        receptors = [f['name'] for f in data.get('files', {}).get('receptors', [])]
        ligands = [f['name'] for f in data.get('files', {}).get('ligands', [])]
        files = receptors + ligands
        
        return ProjectResponse(
            name=data['project_info']['name'],
            path=str(found_path),
            files=files,
            receptors=receptors,
            ligands=ligands
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading project: {e}")

@router.post("/{project_name}/upload")
async def upload_file(
    project_name: str, 
    file: UploadFile = File(...), 
    category: str = Query("auto", enum=["auto", "receptor", "ligand"]),
    pm = Depends(get_project_manager)
):
    """
    Upload a file to the project directory.
    Automatically converts files to PDBQT including correct charge addition.
    Use 'category'='ligand' for PDB ligands to avoid receptor processing errors.
    """
    from api.dependencies import find_project_path
    from core.file_manager import FileManager
    from fastapi import Query
    
    found_path = find_project_path(project_name)
    if not found_path:
        raise HTTPException(status_code=404, detail="Project not found")
    
    file_manager = FileManager()
    
    try:
        # Determine file extension
        ext = file.filename.lower().split('.')[-1]
        filename = file.filename
        
        # LOGIC: Determine target directory (Receptor vs Ligand)
        target_dir_name = "temp" # Default safe fallback
        
        if category == "receptor":
             target_dir_name = "receptors"
        
        elif category == "ligand":
             target_dir_name = "ligands"
             
        elif category == "auto":
             # Heuristic Logic
             if ext in ['pdb', 'pdbqt', 'ent', 'cif']:
                 # DEFAULT PDB -> Receptor (Classic behavior)
                 # BUT this is what caused the bug for ligand PDBs.
                 # We keep it as default but user MUST override for Ligand PDBs.
                 target_dir_name = "receptors"
             elif ext in ['sdf', 'mol2', 'smi']:
                 target_dir_name = "ligands"
        
        target_dir = found_path / target_dir_name
        target_dir.mkdir(parents=True, exist_ok=True)

        file_path = target_dir / filename
        
        # Save original file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Register with ProjectManager
        pm.load_project(found_path)
        
        converted_path = None
        conversion_note = "No conversion needed"
        processing_steps = []
        
        # --- AUTO-PREPARATION Logic ---
        
        # 1. Ligands Processing
        if target_dir_name == "ligands":
            pm.add_ligands([file_path], copy_files=False)
            
            # Convert to PDBQT if not already
            if ext != 'pdbqt':
                print(f"Auto-preparing Ligand: {filename}")
                # prepare_ligand handles charges (Gasteiger) correctly for Vina
                converted_path, steps = file_manager.prepare_ligand(str(file_path), str(target_dir))
                processing_steps.extend(steps)
                
                if converted_path:
                    print(f"Ligand Prepared: {Path(converted_path).name}")
                    pm.add_ligands([Path(converted_path)], copy_files=False)
                    conversion_note = "Auto-converted to PDBQT (Ligand mode)"
                else:
                    conversion_note = "Ligand preparation failed"

        # 2. Receptors Processing
        elif target_dir_name == "receptors":
            pm.add_receptor(file_path, copy_file=False)
            
            # Convert to PDBQT if not already
            if ext != 'pdbqt':
                 print(f"Auto-preparing Receptor: {filename}")
                 # prepare_receptor handles cleanup/polar-h for Vina
                 converted_path, steps = file_manager.prepare_receptor(str(file_path), str(target_dir))
                 processing_steps.extend(steps)
                 
                 if converted_path:
                     print(f"Receptor Prepared: {Path(converted_path).name}")
                     pm.add_receptor(Path(converted_path), copy_file=False)
                     conversion_note = "Auto-converted to PDBQT (Receptor mode)"
                 else:
                     conversion_note = "Receptor preparation failed"
        
        return {
            "filename": filename, 
            "status": "uploaded", 
            "path": str(file_path),
            "target_folder": target_dir_name,
            "converted_file": str(Path(converted_path).name) if converted_path else None,
            "note": conversion_note,
            "processing_steps": processing_steps
        }

    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_name}/fetch")
async def fetch_file(
    project_name: str,
    source: str = Query(..., enum=["pdb", "uniprot"]),
    id: str = Query(..., min_length=3),
    pm = Depends(get_project_manager)
):
    """
    Fetch a structure from RCSB PDB or AlphaFold DB.
    """
    import requests
    from api.dependencies import find_project_path
    from core.file_manager import FileManager
    
    found_path = find_project_path(project_name)
    if not found_path:
        raise HTTPException(status_code=404, detail="Project not found")

    target_dir = found_path / "receptors"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_manager = FileManager()
    
    # 1. Fetch Logic
    try:
        url = ""
        filename = ""
        
        if source == "pdb":
            pdb_id = id.upper()
            url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
            filename = f"{pdb_id}.pdb"
            
        elif source == "uniprot":
            uniprot_id = id.upper()
            # AlphaFold DB URL pattern (v4 is current standard)
            # Try v4, valid for most entries
            url = f"https://alphafold.ebi.ac.uk/files/AF-{uniprot_id}-F1-model_v4.pdb"
            filename = f"AF-{uniprot_id}.pdb"

        print(f"Fetching from: {url}")
        resp = requests.get(url)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Could not fetch ID {id} from {source.upper()} (Status: {resp.status_code})")
            
        file_path = target_dir / filename
        with open(file_path, "wb") as f:
            f.write(resp.content)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

    # 2. Process File
    try:
        # Load project state before adding files
        print(f"DEBUG: Loading project from {found_path}")
        pm.load_project(found_path)
        print(f"DEBUG: Current project path: {pm.current_project_path}")
        
        pm.add_receptor(file_path, copy_file=False)
        converted_path, steps = file_manager.prepare_receptor(str(file_path), str(target_dir))
        
        if converted_path:
             pm.add_receptor(Path(converted_path), copy_file=False)
        
        return {
            "filename": filename,
            "status": "fetched",
            "source": source,
            "path": str(file_path),
            "target_folder": "receptors",
            "converted_file": str(Path(converted_path).name) if converted_path else None,
            "note": f"Fetched from {source.upper()}",
            "processing_steps": ["FETCH_START", "DOWNLOAD_COMPLETE"] + steps
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@router.post("/{project_name}/fetch/ligand")
async def fetch_ligand(
    project_name: str,
    query: str = Query(..., min_length=1),
    pm = Depends(get_project_manager)
):
    """
    Fetch a ligand from PubChem by name or CID.
    """
    import requests
    from api.dependencies import find_project_path
    from core.file_manager import FileManager
    
    found_path = find_project_path(project_name)
    if not found_path:
        raise HTTPException(status_code=404, detail="Project not found")

    target_dir = found_path / "ligands"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_manager = FileManager()
    
    try:
        # 1. Search for CID if query is not numeric
        cid = query
        if not query.isdigit():
            print(f"Searching PubChem for: {query}")
            search_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{query}/cids/JSON"
            resp = requests.get(search_url)
            if resp.status_code != 200:
                 raise HTTPException(status_code=404, detail=f"Ligand '{query}' not found in PubChem")
            data = resp.json()
            if 'IdentifierList' in data and 'CID' in data['IdentifierList']:
                cid = str(data['IdentifierList']['CID'][0])
                print(f"Found CID: {cid}")
            else:
                raise HTTPException(status_code=404, detail=f"No CID found for '{query}'")

        # 2. Download 3D SDF
        print(f"Downloading 3D SDF for CID: {cid}")
        
        headers = {'User-Agent': 'VI DOCKPro/3.1 (Educational; contact@example.com)'}
        sdf_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF?record_type=3d"
        
        resp = requests.get(sdf_url, headers=headers)
        
        if resp.status_code != 200:
             print(f"3D Fetch Failed: {resp.status_code} {resp.text[:100]}")
             # Fallback to 2D
             print("Fetching 2D...")
             sdf_url_2d = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF"
             resp = requests.get(sdf_url_2d, headers=headers)
             
             if resp.status_code != 200:
                print(f"2D Fetch Failed: {resp.status_code}")
                raise HTTPException(status_code=400, detail=f"PubChem Error {resp.status_code} for CID {cid}")

        filename = f"PubChem_{cid}.sdf"
        file_path = target_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(resp.content)

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

    # 3. Process File
    try:
        print(f"DEBUG: Loading project from {found_path}")
        pm.load_project(found_path)
        
        pm.add_ligands([file_path], copy_files=False)
        converted_path, steps = file_manager.prepare_ligand(str(file_path), str(target_dir))
        
        if converted_path:
             pm.add_ligands([Path(converted_path)], copy_files=False)
        
        return {
            "filename": filename,
            "status": "fetched",
            "source": "pubchem",
            "path": str(file_path),
            "target_folder": "ligands",
            "converted_file": str(Path(converted_path).name) if converted_path else None,
            "note": f"Fetched CID {cid} from PubChem",
            "processing_steps": ["SEARCH_COMPLETE", "DOWNLOAD_3D_SDF"] + steps
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

