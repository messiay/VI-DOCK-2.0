"""
Conversion Routes - PDB to PDBQT using OpenBabel
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import tempfile
import os
import subprocess
import shutil
import sys

# Try imports
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    from meeko import MoleculePreparation
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

from utils.config import OBABEL_PATH

router = APIRouter()

def get_obabel_cmd():
    """Get the OpenBabel command/path, checking config and system path."""
    # 1. Check configured path
    if OBABEL_PATH and os.path.exists(OBABEL_PATH):
        return OBABEL_PATH
    
    # 2. Check system path
    if shutil.which("obabel"):
        return "obabel"
        
    # 3. Check common Windows locations as fallbacks
    common_paths = [
        r"C:\Program Files\OpenBabel-2.4.1\obabel.exe",
        r"C:\Program Files (x86)\OpenBabel-2.4.1\obabel.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
            
    return None

def convert_with_rdkit(content: str, input_format: str, add_h: bool = True, is_receptor: bool = False) -> str:
    """
    Convert using RDKit + Meeko (Pure Python).
    Handles PDB, SDF, SMILES.
    Returns PDBQT string.
    """
    if not RDKIT_AVAILABLE:
        raise HTTPException(500, "OpenBabel not found AND RDKit/Meeko not installed. Please install 'rdkit' and 'meeko' via pip.")

    try:
        mol = None
        if input_format == 'pdb':
            mol = Chem.MolFromPDBBlock(content, removeHs=False)
            if mol:
                if add_h:
                    try:
                        mol = Chem.AddHs(mol, addCoords=True)
                    except:
                        pass # Ignore if AddHs fails to preserve existing coords
                
                # If it's a receptor, use the manual rigid writer directly
                if is_receptor:
                    try: AllChem.ComputeGasteigerCharges(mol)
                    except: pass
                    
                    # Manual PDBQT Write for Rigid Receptor
                    pdbqt_lines = []
                    conf = mol.GetConformer()
                    
                    for i, atom in enumerate(mol.GetAtoms()):
                        pos = conf.GetAtomPosition(i)
                        symbol = atom.GetSymbol()
                        
                        # Basic Autodock Type mapping
                        ad_type = symbol
                        if atom.GetIsAromatic() and symbol == 'C':
                            ad_type = 'A'
                        if symbol == 'N' and atom.GetIsAromatic():
                            ad_type = 'N'
                        
                        # Charge
                        charge = 0.0
                        if atom.HasProp('_GasteigerCharge'):
                            try:
                                charge = float(atom.GetProp('_GasteigerCharge'))
                            except: pass
                        
                        # Formatted PDBQT line
                        res_info = atom.GetPDBResidueInfo()
                        res_name = (res_info.GetResidueName() if res_info else "UNK")[:3]
                        chain = (res_info.GetChainId() if res_info else "A")[:1]
                        if not chain.strip(): chain = "A"
                        res_num = (res_info.GetResidueNumber() if res_info else 1)
                        atom_name = (res_info.GetName().strip() if res_info else symbol)[:4]
                        
                        line = f"ATOM  {i+1:>5} {atom_name:^4} {res_name:>3} {chain:>1}{res_num:>4}    {pos.x:>8.3f}{pos.y:>8.3f}{pos.z:>8.3f}  1.00  0.00    {charge:>6.3f} {ad_type:<2}"
                        pdbqt_lines.append(line)
                        
                    return "\n".join(pdbqt_lines)
                
                # Otherwise, try Meeko for ligand
                try:
                    try: AllChem.ComputeGasteigerCharges(mol)
                    except: pass

                    preparator = MoleculePreparation()
                    preparator.prepare(mol)
                    return preparator.write_pdbqt_string()
                except Exception:
                    # Manual PDBQT Write for Rigid Receptor Fallback
                    pdbqt_lines = []
                    conf = mol.GetConformer()
                    for i, atom in enumerate(mol.GetAtoms()):
                        pos = conf.GetAtomPosition(i)
                        symbol = atom.GetSymbol()
                        ad_type = symbol
                        if atom.GetIsAromatic() and symbol == 'C': ad_type = 'A'
                        if symbol == 'N' and atom.GetIsAromatic(): ad_type = 'N'
                        charge = 0.0
                        if atom.HasProp('_GasteigerCharge'):
                            try: charge = float(atom.GetProp('_GasteigerCharge'))
                            except: pass
                        res_info = atom.GetPDBResidueInfo()
                        res_name = (res_info.GetResidueName() if res_info else "UNK")[:3]
                        chain = (res_info.GetChainId() if res_info else "A")[:1]
                        res_num = (res_info.GetResidueNumber() if res_info else 1)
                        atom_name = (res_info.GetName().strip() if res_info else symbol)[:4]
                        line = f"ATOM  {i+1:>5} {atom_name:^4} {res_name:>3} {chain:>1}{res_num:>4}    {pos.x:>8.3f}{pos.y:>8.3f}{pos.z:>8.3f}  1.00  0.00    {charge:>6.3f} {ad_type:<2}"
                        pdbqt_lines.append(line)
                    return "\n".join(pdbqt_lines)

        elif input_format == 'sdf':
            mol = Chem.MolFromMolBlock(content, removeHs=False)
        elif input_format == 'smiles':
            mol = Chem.MolFromSmiles(content)
            if mol:
                mol = Chem.AddHs(mol)
                AllChem.EmbedMolecule(mol)
        
        if mol is None:
            raise ValueError("Could not parse molecule")

        if add_h:
            mol = Chem.AddHs(mol, addCoords=True)
            
        preparator = MoleculePreparation()
        preparator.prepare(mol)
        return preparator.write_pdbqt_string()
        
    except Exception as e:
        raise HTTPException(500, f"RDKit conversion failed: {str(e)}")

class ConversionRequest(BaseModel):
    pdb_content: str
    add_hydrogens: bool = True
    
class ConversionResponse(BaseModel):
    pdbqt_content: str
    success: bool
    message: str

@router.post("/pdb-to-pdbqt", response_model=ConversionResponse)
async def convert_pdb_to_pdbqt(request: ConversionRequest):
    """
    Convert PDB content to PDBQT format using OpenBabel with RDKit fallback.
    """
    obabel_cmd = get_obabel_cmd()
    
    if not obabel_cmd:
        if RDKIT_AVAILABLE:
            # Receptors in this endpoint are always rigid (Vina style)
            pdbqt = convert_with_rdkit(request.pdb_content, 'pdb', request.add_hydrogens, is_receptor=True)
            return ConversionResponse(
                pdbqt_content=pdbqt,
                success=True,
                message=f"Converted PDB to PDBQT using RDKit (OpenBabel not found)"
            )
        else:
             raise HTTPException(status_code=500, detail=f"OpenBabel and RDKit fallback unavailable.")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            input_pdb = os.path.join(temp_dir, "input.pdb")
            output_pdbqt = os.path.join(temp_dir, "output.pdbqt")
            with open(input_pdb, 'w') as f:
                f.write(request.pdb_content)
            
            cmd = [obabel_cmd, "-ipdb", input_pdb, "-opdbqt", "-O", output_pdbqt, "-xr", "--partialcharge", "gasteiger"]
            if request.add_hydrogens:
                cmd.insert(3, "-h")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown OpenBabel error"
                if RDKIT_AVAILABLE:
                    try:
                        # Receptors in this endpoint are always rigid (Vina style)
                        pdbqt = convert_with_rdkit(request.pdb_content, 'pdb', request.add_hydrogens, is_receptor=True)
                        return ConversionResponse(
                            pdbqt_content=pdbqt, success=True,
                            message=f"Converted PDB to PDBQT using RDKit (OpenBabel failed: {error_msg.splitlines()[0] if error_msg else ''})"
                        )
                    except Exception as rd_error:
                        raise HTTPException(status_code=500, detail=f"OpenBabel failed ({error_msg}) AND RDKit failed: {str(rd_error)}")
                else:
                    raise HTTPException(status_code=500, detail=f"OpenBabel conversion failed: {error_msg}")
            
            if not os.path.exists(output_pdbqt):
                raise HTTPException(status_code=500, detail="OpenBabel did not produce output file")
            
            with open(output_pdbqt, 'r') as f:
                pdbqt_content = f.read()
            
            return ConversionResponse(pdbqt_content=pdbqt_content, success=True, message="Successfully converted PDB to PDBQT")
            
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="OpenBabel conversion timed out")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")

class SdfConversionRequest(BaseModel):
    sdf_content: str
    add_hydrogens: bool = True

@router.post("/sdf-to-pdbqt", response_model=ConversionResponse)
async def convert_sdf_to_pdbqt(request: SdfConversionRequest):
    """
    Convert SDF/MOL content to PDBQT format using OpenBabel with Meeko fallback.
    """
    obabel_cmd = get_obabel_cmd()
    
    if not obabel_cmd:
        if RDKIT_AVAILABLE:
            pdbqt = convert_with_rdkit(request.sdf_content, 'sdf', request.add_hydrogens)
            return ConversionResponse(
                pdbqt_content=pdbqt, success=True,
                message=f"Converted SDF to PDBQT using Meeko (OpenBabel not found)"
            )
        else:
            raise HTTPException(status_code=500, detail=f"OpenBabel and RDKit fallback unavailable.")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            input_sdf = os.path.join(temp_dir, "input.sdf")
            output_pdbqt = os.path.join(temp_dir, "output.pdbqt")
            with open(input_sdf, 'w') as f:
                f.write(request.sdf_content)
            
            cmd = [obabel_cmd, "-isdf", input_sdf, "-opdbqt", "-O", output_pdbqt, "--partialcharge", "gasteiger"]
            if request.add_hydrogens:
                cmd.insert(3, "-h")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown OpenBabel error"
                if RDKIT_AVAILABLE:
                    try:
                        pdbqt = convert_with_rdkit(request.sdf_content, 'sdf', request.add_hydrogens)
                        return ConversionResponse(
                            pdbqt_content=pdbqt, success=True,
                            message=f"Converted SDF to PDBQT using Meeko (OpenBabel failed: {error_msg.splitlines()[0] if error_msg else ''})"
                        )
                    except Exception as rd_error:
                        raise HTTPException(status_code=500, detail=f"OpenBabel failed ({error_msg}) AND Meeko failed: {str(rd_error)}")
                else:
                    raise HTTPException(status_code=500, detail=f"OpenBabel conversion failed: {error_msg}")
            
            with open(output_pdbqt, 'r') as f:
                pdbqt_content = f.read()
            return ConversionResponse(pdbqt_content=pdbqt_content, success=True, message="Converted SDF to PDBQT")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")

class SmilesConversionRequest(BaseModel):
    smiles: str
    name: str = "ligand"

@router.post("/smiles-to-pdbqt", response_model=ConversionResponse)
async def convert_smiles_to_pdbqt(request: SmilesConversionRequest):
    """
    Convert SMILES string to 3D PDBQT using OpenBabel with RDKit+Meeko fallback.
    """
    obabel_cmd = get_obabel_cmd()
    
    if not obabel_cmd:
        if RDKIT_AVAILABLE:
            pdbqt = convert_with_rdkit(request.smiles, 'smiles', True)
            return ConversionResponse(
                pdbqt_content=pdbqt, success=True,
                message=f"Converted SMILES to PDBQT using RDKit (OpenBabel not found)"
            )
        else:
            raise HTTPException(status_code=500, detail="OpenBabel and RDKit fallback unavailable.")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            input_smi = os.path.join(temp_dir, "input.smi")
            output_pdbqt = os.path.join(temp_dir, "output.pdbqt")
            with open(input_smi, 'w') as f:
                f.write(f"{request.smiles} {request.name}")
            
            cmd = [obabel_cmd, "-ismi", input_smi, "-opdbqt", "-O", output_pdbqt, "--gen3d", "-h", "--partialcharge", "gasteiger"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown OpenBabel error"
                if RDKIT_AVAILABLE:
                    try:
                        pdbqt = convert_with_rdkit(request.smiles, 'smiles', True)
                        return ConversionResponse(
                            pdbqt_content=pdbqt, success=True,
                            message=f"Converted SMILES to PDBQT using RDKit+Meeko (OpenBabel failed: {error_msg.splitlines()[0] if error_msg else ''})"
                        )
                    except Exception as rd_error:
                        raise HTTPException(status_code=500, detail=f"OpenBabel failed ({error_msg}) AND RDKit failed: {str(rd_error)}")
                else:
                    raise HTTPException(status_code=500, detail=f"OpenBabel conversion failed: {error_msg}")
            
            with open(output_pdbqt, 'r') as f:
                pdbqt_content = f.read()
            return ConversionResponse(pdbqt_content=pdbqt_content, success=True, message="Converted SMILES to 3D PDBQT")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")
