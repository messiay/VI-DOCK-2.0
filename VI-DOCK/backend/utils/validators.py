import os
from typing import List


def validate_pdb_id(pdb_id: str) -> bool:
    """Validate PDB ID format."""
    pdb_id = pdb_id.strip().upper()
    return len(pdb_id) == 4 and pdb_id.isalnum()


def validate_ligand_files(file_paths: List[str]) -> List[str]:
    """Validate ligand files and return valid ones."""
    valid_files = []
    supported_exts = ('.pdb', '.sdf', '.mol2')
    
    for file_path in file_paths:
        if (os.path.exists(file_path) and 
            os.path.isfile(file_path) and 
            file_path.lower().endswith(supported_exts)):
            valid_files.append(file_path)
    
    return valid_files


def validate_docking_parameters(center: tuple, size: tuple) -> bool:
    """Validate docking parameters."""
    if not all(isinstance(x, (int, float)) for x in center + size):
        return False
    if any(s <= 0 for s in size):
        return False
    return True
