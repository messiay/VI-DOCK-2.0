"""
Fetch Routes - PDB and PubChem data fetching via backend
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import urllib.request
import urllib.parse
import urllib.error
import ssl
import tempfile
import os
import subprocess

from utils.config import OBABEL_PATH

router = APIRouter()


class PdbResponse(BaseModel):
    pdb_content: str
    pdb_id: str
    title: str
    success: bool


@router.get("/pdb/{pdb_id}", response_model=PdbResponse)
async def fetch_pdb(pdb_id: str):
    """
    Fetch PDB structure from RCSB and return cleaned content.
    Removes waters and HETATMs for docking preparation.
    """
    pdb_id = pdb_id.strip().upper()
    if len(pdb_id) != 4 or not pdb_id.isalnum():
        raise HTTPException(status_code=400, detail="Invalid PDB ID (must be 4 alphanumeric characters)")
    
    url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
    
    try:
        # SSL context for HTTPS
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(url, context=ctx, timeout=30) as response:
            pdb_content = response.read().decode('utf-8')
        
        # Extract title from PDB
        title = pdb_id
        for line in pdb_content.split('\n'):
            if line.startswith('TITLE'):
                title = line[10:].strip()
                break
        
        # Clean: keep only ATOM records (remove waters, ligands, etc.)
        cleaned_lines = []
        for line in pdb_content.split('\n'):
            if line.startswith('ATOM '):
                cleaned_lines.append(line)
        cleaned_lines.append('END')
        cleaned_content = '\n'.join(cleaned_lines)
        
        return PdbResponse(
            pdb_content=cleaned_content,
            pdb_id=pdb_id,
            title=title,
            success=True
        )
        
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=404, detail=f"PDB {pdb_id} not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch PDB: {str(e)}")


class PubChemResponse(BaseModel):
    sdf_content: str
    pdbqt_content: str
    name: str
    cid: str
    success: bool


@router.get("/pubchem/{query}", response_model=PubChemResponse)
async def fetch_pubchem(query: str, convert_to_pdbqt: bool = True):
    """
    Fetch compound from PubChem by CID or name.
    Optionally converts to PDBQT using OpenBabel.
    """
    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    # Determine if CID or name
    if query.isdigit():
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{query}/SDF?record_type=3d"
    else:
        encoded = urllib.parse.quote(query)
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{encoded}/SDF?record_type=3d"
    
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(url, context=ctx, timeout=30) as response:
            sdf_content = response.read().decode('utf-8')
        
        # Extract CID from response
        cid = query if query.isdigit() else "unknown"
        name = query
        
        pdbqt_content = ""
        
        # Convert to PDBQT if requested and OpenBabel is available
        if convert_to_pdbqt and OBABEL_PATH and os.path.exists(OBABEL_PATH):
            try:
                with tempfile.TemporaryDirectory() as temp_dir:
                    input_sdf = os.path.join(temp_dir, "input.sdf")
                    output_pdbqt = os.path.join(temp_dir, "output.pdbqt")
                    
                    with open(input_sdf, 'w') as f:
                        f.write(sdf_content)
                    
                    cmd = [
                        OBABEL_PATH,
                        "-isdf", input_sdf,
                        "-opdbqt", "-O", output_pdbqt,
                        "-h",
                        "--partialcharge", "gasteiger"
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                    
                    if result.returncode == 0 and os.path.exists(output_pdbqt):
                        with open(output_pdbqt, 'r') as f:
                            pdbqt_content = f.read()
            except Exception as conv_err:
                print(f"PDBQT conversion failed: {conv_err}")
        
        return PubChemResponse(
            sdf_content=sdf_content,
            pdbqt_content=pdbqt_content,
            name=name,
            cid=cid,
            success=True
        )
        
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=404, detail=f"Compound '{query}' not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from PubChem: {str(e)}")
