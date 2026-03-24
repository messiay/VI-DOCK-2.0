import streamlit as st
import os
import tempfile
import shutil
from pathlib import Path
import pandas as pd
import subprocess
import sys
import zipfile
import sqlite3
import urllib.request

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.docking_manager import DockingManager
from core.project_manager import ProjectManager
from utils.config import get_config_manager
from core.docking_engine import DockingEngineFactory

st.set_page_config(
    page_title="VI DOCK Pro Web",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Helper Functions ---
def save_uploaded_file(uploaded_file):
    """Save uploaded file to a temporary directory and return the path."""
    if uploaded_file is None:
        return None
    
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, uploaded_file.name)
    
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
        
    return file_path

def cleanup_temp_files(paths):
    """Remove temporary files."""
    for path in paths:
        if path and os.path.exists(path):
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
            except:
                pass

def download_pdb(pdb_id, output_dir):
    """Download PDB file."""
    url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
    output_path = os.path.join(output_dir, f"{pdb_id}.pdb")
    try:
        urllib.request.urlretrieve(url, output_path)
        return output_path
    except Exception as e:
        st.error(f"Failed to download PDB {pdb_id}: {e}")
        return None

# --- UI Layout ---
st.title("🧬 VI DOCK Pro Web")
st.markdown("### GPU-Accelerated Molecular Docking in the Cloud")

# Sidebar - Configuration
with st.sidebar:
    st.header("Configuration")
    
    engine_type = st.selectbox(
        "Docking Engine",
        ["vina", "smina", "gnina", "qvina", "ledock"],
        index=0,
        help="Select the docking engine to use."
    )
    
    st.subheader("Docking Parameters")
    exhaustiveness = st.slider("Exhaustiveness", 1, 64, 8, help="Higher values = more accurate but slower.")
    num_modes = st.slider("Number of Modes", 1, 20, 9)
    energy_range = st.slider("Energy Range (kcal/mol)", 1.0, 10.0, 3.0)
    
    st.subheader("Box Configuration")
    center_x = st.number_input("Center X", value=0.0)
    center_y = st.number_input("Center Y", value=0.0)
    center_z = st.number_input("Center Z", value=0.0)
    
    size_x = st.number_input("Size X", value=20.0)
    size_y = st.number_input("Size Y", value=20.0)
    size_z = st.number_input("Size Z", value=20.0)


    st.markdown("---")
    with st.expander("🖥️ System Status"):
        cm = get_config_manager()
        st.write(f"**OS:** {sys.platform}")
        st.write(f"**Vina Path:** `{cm.get_executable_path('vina')}`")
        st.write(f"**Obabel Path:** `{cm.get_executable_path('obabel')}`")
        st.write(f"**Working Dir:** `{os.getcwd()}`")

# Tabs
tab1, tab2, tab3 = st.tabs(["🧪 Single Docking", "📦 Batch Docking", "📥 Tools & Analysis"])

# --- Tab 1: Single Docking ---
with tab1:
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("1. Upload Receptor")
        receptor_file = st.file_uploader("Upload Receptor (PDB/PDBQT)", type=["pdb", "pdbqt"], key="single_rec")
        
        st.markdown("**OR** Download from PDB")
        pdb_id = st.text_input("Enter PDB ID (e.g., 1HSG)", max_chars=4).upper()
        if st.button("Fetch PDB"):
            if len(pdb_id) == 4:
                with st.spinner(f"Downloading {pdb_id}..."):
                    temp_dir = tempfile.mkdtemp()
                    path = download_pdb(pdb_id, temp_dir)
                    if path:
                        st.success(f"Downloaded {pdb_id}!")
                        st.session_state['fetched_pdb'] = path
            else:
                st.warning("Invalid PDB ID")

    with col2:
        st.subheader("2. Upload Ligand")
        ligand_file = st.file_uploader("Upload Ligand (PDB/SDF/MOL2)", type=["pdb", "sdf", "mol2"], key="single_lig")

    # Docking Action
    if st.button("🚀 Run Single Docking", type="primary", use_container_width=True):
        receptor_path = None
        if receptor_file:
            receptor_path = save_uploaded_file(receptor_file)
        elif 'fetched_pdb' in st.session_state:
            receptor_path = st.session_state['fetched_pdb']
            
        ligand_path = save_uploaded_file(ligand_file)
        
        if not receptor_path or not ligand_path:
            st.error("Please provide both a receptor and a ligand.")
        else:
            with st.spinner("Running docking simulation..."):
                try:
                    output_dir = tempfile.mkdtemp()
                    output_file = os.path.join(output_dir, "docking_results.pdbqt")
                    center = (center_x, center_y, center_z)
                    size = (size_x, size_y, size_z)
                    
                    engine = DockingEngineFactory.create_engine(engine_type)
                    
                    results = engine.run_docking(
                        receptor_path, 
                        ligand_path, 
                        output_file, 
                        center, 
                        size, 
                        exhaustiveness=exhaustiveness,
                        num_modes=num_modes,
                        energy_range=energy_range
                    )
                    
                    if results['success']:
                        st.success("Docking Completed Successfully!")
                        
                        # Display Results
                        st.subheader("Docking Scores")
                        scores = results.get('scores', [])
                        if scores:
                            df = pd.DataFrame(scores)
                            st.dataframe(df, use_container_width=True)
                            
                            csv = df.to_csv(index=False).encode('utf-8')
                            st.download_button("Download Scores (CSV)", csv, "docking_scores.csv", "text/csv")
                        
                        if os.path.exists(output_file):
                            with open(output_file, "rb") as f:
                                st.download_button("Download Poses (PDBQT)", f, "docked_poses.pdbqt", "chemical/x-pdbqt")
                                
                    else:
                        st.error(f"Docking Failed: {results.get('error')}")
                        if 'output' in results:
                            with st.expander("View Log"):
                                st.code(results['output'])
                                
                except Exception as e:
                    st.error(f"An error occurred: {str(e)}")
                    st.exception(e)

# --- Tab 2: Batch Docking ---
with tab2:
    st.subheader("Batch Docking")
    st.info("Upload a ZIP file containing multiple ligands to dock them all against the receptor.")
    
    batch_receptor = st.file_uploader("Upload Receptor (PDB/PDBQT)", type=["pdb", "pdbqt"], key="batch_rec")
    batch_ligands = st.file_uploader("Upload Ligands (ZIP)", type=["zip"], key="batch_zip")
    
    if st.button("🚀 Run Batch Docking", type="primary"):
        if not batch_receptor or not batch_ligands:
            st.error("Please upload both receptor and ligands zip.")
        else:
            with st.spinner("Processing batch..."):
                # Setup directories
                work_dir = tempfile.mkdtemp()
                rec_path = os.path.join(work_dir, batch_receptor.name)
                with open(rec_path, "wb") as f:
                    f.write(batch_receptor.getbuffer())
                
                # Extract ZIP
                ligands_dir = os.path.join(work_dir, "ligands")
                os.makedirs(ligands_dir, exist_ok=True)
                with zipfile.ZipFile(batch_ligands, 'r') as zip_ref:
                    zip_ref.extractall(ligands_dir)
                
                # Find ligands
                ligand_files = []
                for root, dirs, files in os.walk(ligands_dir):
                    for file in files:
                        if file.lower().endswith(('.pdb', '.sdf', '.mol2', '.pdbqt')):
                            ligand_files.append(os.path.join(root, file))
                
                st.write(f"Found {len(ligand_files)} ligands.")
                
                # Run Docking Loop
                results_list = []
                progress_bar = st.progress(0)
                
                engine = DockingEngineFactory.create_engine(engine_type)
                center = (center_x, center_y, center_z)
                size = (size_x, size_y, size_z)
                
                for i, lig_path in enumerate(ligand_files):
                    lig_name = os.path.basename(lig_path)
                    out_path = os.path.join(work_dir, f"out_{lig_name}.pdbqt")
                    
                    res = engine.run_docking(
                        rec_path, lig_path, out_path, center, size,
                        exhaustiveness=exhaustiveness
                    )
                    
                    if res['success']:
                        top_score = res['scores'][0]['Affinity (kcal/mol)'] if res['scores'] else 0
                        results_list.append({
                            "Ligand": lig_name,
                            "Affinity": top_score,
                            "Status": "Success"
                        })
                    else:
                        results_list.append({
                            "Ligand": lig_name,
                            "Affinity": None,
                            "Status": "Failed"
                        })
                    
                    progress_bar.progress((i + 1) / len(ligand_files))
                
                # Show Summary
                st.success("Batch Docking Complete!")
                df_batch = pd.DataFrame(results_list)
                st.dataframe(df_batch)
                
                csv_batch = df_batch.to_csv(index=False).encode('utf-8')
                st.download_button("Download Batch Results (CSV)", csv_batch, "batch_results.csv", "text/csv")

# --- Tab 3: Tools ---
with tab3:
    st.subheader("Tools")
    st.markdown("### 3D Visualization")
    st.info("Use the 'Single Docking' tab to visualize results after docking.")
    
    st.markdown("### Database Viewer")
    st.write("If you have a project.db file, upload it here to view results.")
    db_file = st.file_uploader("Upload project.db", type=["db", "sqlite"])
    
    if db_file:
        # Save to temp
        temp_db = save_uploaded_file(db_file)
        conn = sqlite3.connect(temp_db)
        try:
            query = "SELECT * FROM docking_results"
            df_db = pd.read_sql_query(query, conn)
            st.dataframe(df_db)
        except Exception as e:
            st.error(f"Error reading database: {e}")
        finally:
            conn.close()

st.markdown("---")
st.info("💡 Note: This app is designed to run in Google Colab for GPU acceleration.")
