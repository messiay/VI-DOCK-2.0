import os
import math
from typing import List, Dict, Tuple, Optional

class PocketFinder:
    """Detects potential binding pockets in PDB files."""
    
    def __init__(self):
        pass
        
    def find_pockets(self, pdb_path: str) -> List[Dict]:
        """
        Find potential binding pockets in a PDB file.
        """
        pockets = []
        
        if not os.path.exists(pdb_path):
            return []
            
        try:
            # 1. Parse SITE records
            site_pockets = self._parse_site_records(pdb_path)
            pockets.extend(site_pockets)
            
            # 2. Parse HETATM ligands (co-crystallized)
            ligand_pockets = self._find_ligands(pdb_path)
            pockets.extend(ligand_pockets)
            
            # Deduplicate based on proximity
            unique_pockets = self._deduplicate_pockets(pockets)
            
            return unique_pockets
            
        except Exception as e:
            print(f"Error finding pockets: {e}")
            return []
    
    def _parse_site_records(self, pdb_path: str) -> List[Dict]:
        """Parse PDB SITE records and calculate centers."""
        site_residues = {} # site_id -> list of (chain, seq)
        
        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("SITE "):
                    try:
                        site_id = line[11:14].strip()
                        if site_id not in site_residues:
                            site_residues[site_id] = []
                        
                        # Parse up to 4 residues per line
                        # Res 1: 19-21 (name), 23 (chain), 24-27 (seq)
                        # Res 2: 30-32, 34, 35-38
                        # Res 3: 41-43, 45, 46-49
                        # Res 4: 52-54, 56, 57-60
                        
                        offsets = [18, 29, 40, 51]
                        for i in offsets:
                            if len(line) > i+10:
                                res_name = line[i:i+3].strip()
                                if not res_name: continue
                                chain = line[i+4]
                                seq = line[i+5:i+9].strip()
                                site_residues[site_id].append((chain, seq))
                    except Exception:
                        continue
        
        if not site_residues:
            return []
            
        # Now find coordinates for these residues
        pockets = []
        for site_id, residues in site_residues.items():
            coords = self._get_residue_coordinates(pdb_path, residues)
            if not coords:
                continue
                
            center = self._calculate_center(coords)
            size = self._calculate_size(coords)
            
            pockets.append({
                'name': f"Site {site_id}",
                'description': f"PDB Site Record {site_id} ({len(residues)} residues)",
                'center': center,
                'size': size
            })
            
        return pockets

    def _get_residue_coordinates(self, pdb_path: str, target_residues: List[Tuple[str, str]]) -> List[Tuple[float, float, float]]:
        """Get coordinates for a list of residues (chain, seq)."""
        coords = []
        targets = set(target_residues) # Set of (chain, seq)
        
        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("ATOM ") or line.startswith("HETATM"):
                    try:
                        chain = line[21]
                        seq = line[22:26].strip()
                        
                        if (chain, seq) in targets:
                            x = float(line[30:38])
                            y = float(line[38:46])
                            z = float(line[46:54])
                            coords.append((x, y, z))
                    except:
                        continue
        return coords

    def _find_ligands(self, pdb_path: str) -> List[Dict]:
        """Find non-water HETATM groups."""
        ligands = {} # (resName, chain, resSeq) -> list of coords
        
        ignored_res = {'HOH', 'WAT', 'TIP', 'SOL', 'NA', 'CL', 'K', 'MG', 'CA', 'ZN', 'MN', 'FE'}
        
        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("HETATM"):
                    try:
                        res_name = line[17:20].strip()
                        if res_name in ignored_res:
                            continue
                            
                        chain_id = line[21]
                        res_seq = line[22:26].strip()
                        
                        x = float(line[30:38])
                        y = float(line[38:46])
                        z = float(line[46:54])
                        
                        key = (res_name, chain_id, res_seq)
                        if key not in ligands:
                            ligands[key] = []
                        ligands[key].append((x, y, z))
                        
                    except (ValueError, IndexError):
                        continue
        
        pockets = []
        for key, coords in ligands.items():
            res_name, chain_id, res_seq = key
            
            # Filter small fragments (e.g. < 5 atoms)
            if len(coords) < 5:
                continue
                
            center = self._calculate_center(coords)
            size = self._calculate_size(coords)
            
            pockets.append({
                'name': f"Ligand {res_name}",
                'description': f"Chain {chain_id}, Residue {res_seq} ({len(coords)} atoms)",
                'center': center,
                'size': size
            })
            
        return pockets

    def _calculate_center(self, coords: List[Tuple[float, float, float]]) -> Tuple[float, float, float]:
        """Calculate geometric center."""
        if not coords:
            return (0.0, 0.0, 0.0)
            
        x_sum = sum(c[0] for c in coords)
        y_sum = sum(c[1] for c in coords)
        z_sum = sum(c[2] for c in coords)
        n = len(coords)
        
        return (x_sum/n, y_sum/n, z_sum/n)

    def _calculate_size(self, coords: List[Tuple[float, float, float]], padding: float = 10.0) -> Tuple[float, float, float]:
        """Calculate box size enclosing the coordinates."""
        if not coords:
            return (20.0, 20.0, 20.0)
            
        min_x = min(c[0] for c in coords)
        max_x = max(c[0] for c in coords)
        min_y = min(c[1] for c in coords)
        max_y = max(c[1] for c in coords)
        min_z = min(c[2] for c in coords)
        max_z = max(c[2] for c in coords)
        
        return (
            (max_x - min_x) + padding,
            (max_y - min_y) + padding,
            (max_z - min_z) + padding
        )

    def _deduplicate_pockets(self, pockets: List[Dict], threshold: float = 2.0) -> List[Dict]:
        """Merge pockets that are very close to each other."""
        unique = []
        
        for p in pockets:
            is_duplicate = False
            for u in unique:
                dist = math.sqrt(
                    (p['center'][0] - u['center'][0])**2 +
                    (p['center'][1] - u['center'][1])**2 +
                    (p['center'][2] - u['center'][2])**2
                )
                if dist < threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique.append(p)
                
        return unique
