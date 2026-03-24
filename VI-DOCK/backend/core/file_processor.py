import os
import urllib.request
import urllib.parse
import urllib.error
import ssl
from typing import List, Tuple, Optional

from utils.config import OBABEL_PATH
from utils.helpers import run_command


class FileProcessor:
    """Handles file operations, downloads, and conversions."""
    
    @staticmethod
    def fetch_pdb_structure(pdb_id: str, temp_dir: str) -> Optional[str]:
        """Download and clean PDB structure."""
        pdb_id = pdb_id.strip().upper()
        if len(pdb_id) != 4 or not pdb_id.isalnum():
            raise ValueError("Invalid PDB ID")
            
        url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
        original_path = os.path.join(temp_dir, f"{pdb_id}_original.pdb")
        
        try:
            # Create unverified SSL context to avoid certificate errors
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            with urllib.request.urlopen(url, context=ctx) as response, open(original_path, 'wb') as out_file:
                out_file.write(response.read())
        except urllib.error.URLError as e:
            raise ConnectionError(f"Could not download PDB ID {pdb_id}: {e}")
        
        # Clean receptor (remove water and HETATMs)
        cleaned_path = os.path.join(temp_dir, f"{pdb_id}_cleaned.pdb")
        with open(original_path, 'r') as infile, open(cleaned_path, 'w') as outfile:
            for line in infile:
                if line.startswith("ATOM "):
                    outfile.write(line)
        
        return cleaned_path

    @staticmethod
    def fetch_pubchem_ligand(identifier: str, temp_dir: str) -> Optional[str]:
        """Download ligand from PubChem."""
        identifier = identifier.strip()
        if not identifier:
            raise ValueError("Invalid identifier")
            
        encoded_id = urllib.parse.quote(identifier)
        
        if identifier.isdigit():
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{encoded_id}/SDF?record_type=3d"
        else:
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{encoded_id}/SDF?record_type=3d"
        
        ligand_path = os.path.join(temp_dir, f"{identifier}.sdf")
        
        try:
            # Create unverified SSL context
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            with urllib.request.urlopen(url, context=ctx) as response, open(ligand_path, 'wb') as out_file:
                out_file.write(response.read())
            return ligand_path
        except urllib.error.URLError as e:
            raise ConnectionError(f"Could not download ligand '{identifier}': {e}")

    @staticmethod
    def get_coordinates_from_file(file_path: str, temp_dir: str) -> Optional[List[Tuple[float, float, float]]]:
        """Extract coordinates from molecular file."""
        temp_pdb = os.path.join(temp_dir, "temp_coords.pdb")
        file_ext = os.path.splitext(file_path)[1][1:]
        
        command = [OBABEL_PATH, "-i", file_ext, file_path, "-o", "pdb", "-O", temp_pdb]
        result = run_command(command)
        
        if result.returncode != 0:
            raise RuntimeError(f"OpenBabel conversion failed: {result.stderr.strip() if result.stderr else 'Unknown error'}")

        if not os.path.exists(temp_pdb):
            raise FileNotFoundError("OpenBabel failed to generate PDB file.")
            
        coords = []
        try:
            with open(temp_pdb, 'r') as f:
                for line in f:
                    if line.startswith(("ATOM", "HETATM")):
                        coords.append((
                            float(line[30:38]), 
                            float(line[38:46]), 
                            float(line[46:54])
                        ))
        except (ValueError, IndexError):
            return None
            
        return coords

    @staticmethod
    def calculate_bounding_box(coords: List[Tuple[float, float, float]], 
                             padding: float = 5.0) -> Tuple[Tuple[float, float, float], 
                                                          Tuple[float, float, float]]:
        """Calculate bounding box from coordinates."""
        if not coords:
            raise ValueError("No coordinates provided")
            
        min_coords = [min(c[i] for c in coords) for i in range(3)]
        max_coords = [max(c[i] for c in coords) for i in range(3)]
        
        center = [(min_coords[i] + max_coords[i]) / 2 for i in range(3)]
        size = [(max_coords[i] - min_coords[i]) + padding for i in range(3)]
        
        return tuple(center), tuple(size)

    @staticmethod
    def get_ligand_based_box(coords: List[Tuple[float, float, float]], 
                           size: Tuple[float, float, float] = (25.0, 25.0, 25.0)) -> Tuple[Tuple[float, float, float], 
                                                                                          Tuple[float, float, float]]:
        """Calculate box centered on ligand."""
        if not coords:
            raise ValueError("No coordinates provided")
            
        min_coords = [min(c[i] for c in coords) for i in range(3)]
        max_coords = [max(c[i] for c in coords) for i in range(3)]
        
        center = [(min_coords[i] + max_coords[i]) / 2 for i in range(3)]
        return tuple(center), size
