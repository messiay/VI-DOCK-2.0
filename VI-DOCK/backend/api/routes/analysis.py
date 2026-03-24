from fastapi import APIRouter, Depends, HTTPException
from api.models import GridBoxConfig, GridBoxResponse
from api.dependencies import get_project_manager
from core.pocket_finder import PocketFinder
import os
from pathlib import Path

router = APIRouter()

@router.post("/{project_name}/pockets")
def find_pockets(project_name: str, receptor_file: str, pm = Depends(get_project_manager)):
    """
    Find potential binding pockets (active sites) in the receptor.
    Returns list of pockets with center/size suitable for GridBox.
    """
    from api.dependencies import find_project_path
    from core.pocket_finder import PocketFinder
    
    project_path = find_project_path(project_name)
    if not project_path or not project_path.exists():
         raise HTTPException(status_code=404, detail="Project not found")
         
    # Receptor could be in receptors/ or root
    receptor_path = project_path / "receptors" / receptor_file
    if not receptor_path.exists():
        # Try finding it if they just passed the name
        possible = list((project_path / "receptors").glob(f"{receptor_file}*"))
        if possible:
             receptor_path = possible[0]
        else:
             raise HTTPException(status_code=404, detail=f"Receptor file {receptor_file} not found")
        
    finder = PocketFinder()
    try:
        pockets = finder.find_pockets(str(receptor_path))
        # Enhance response for GridBox usage
        for p in pockets:
            p['gridbox'] = {
                'center_x': p['center'][0],
                'center_y': p['center'][1],
                'center_z': p['center'][2],
                'size_x': p['size'][0],
                'size_y': p['size'][1],
                'size_z': p['size'][2]
            }
        return pockets
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_name}/gridbox", response_model=GridBoxResponse)
def calculate_gridbox(project_name: str, ligand_file: str, pm = Depends(get_project_manager)):
    """Calculate gridbox from a ligand file (autoboxing)."""
    from api.dependencies import find_project_path
    project_path = find_project_path(project_name)
    if not project_path or not project_path.exists():
         raise HTTPException(status_code=404, detail="Project not found")

    # Locate ligand file (could be in ligands/, temp/, or receptors/)
    possible_paths = [
        project_path / "ligands" / ligand_file,
        project_path / "temp" / ligand_file,
        project_path / "receptors" / ligand_file
    ]
    
    ligand_path = None
    for p in possible_paths:
        if p.exists():
            ligand_path = p
            break
    
    if not ligand_path:
        raise HTTPException(status_code=404, detail=f"File {ligand_file} not found in project folders.")

    try:
        # Simple parsing logic to find min/max coordinates
        # Works for PDB/PDBQT/SDF (if structured correctly)
        coords = []
        with open(ligand_path, 'r') as f:
            for line in f:
                if line.startswith("ATOM") or line.startswith("HETATM"):
                    # PDB/PDBQT format: x=30-38, y=38-46, z=46-54
                    try:
                        x = float(line[30:38])
                        y = float(line[38:46])
                        z = float(line[46:54])
                        coords.append((x, y, z))
                    except ValueError:
                        pass
        
        if not coords:
            # Fallback for small mols or other formats if needed
             raise ValueError("Could not extract coordinates from file")

        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        zs = [c[2] for c in coords]

        center_x = (min(xs) + max(xs)) / 2
        center_y = (min(ys) + max(ys)) / 2
        center_z = (min(zs) + max(zs)) / 2
        
        # Add buffer (e.g. 10A)
        size_x = (max(xs) - min(xs)) + 10.0
        size_y = (max(ys) - min(ys)) + 10.0
        size_z = (max(zs) - min(zs)) + 10.0
        
        return GridBoxResponse(
            center_x=round(center_x, 3),
            center_y=round(center_y, 3),
            center_z=round(center_z, 3),
            size_x=round(size_x, 3),
            size_y=round(size_y, 3),
            size_z=round(size_z, 3),
            notes=f"Calculated from {len(coords)} atoms."
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
