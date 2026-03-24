# VI DOCK Pro - Features Overview

VI DOCK Pro is a comprehensive, browser-based molecular docking platform powered by a FastAPI backend and a React/3Dmol frontend.

## 1. Single Docking
- **Receptor Input**: Supports direct file upload for PDB and PDBQT formats, or seamless fetching from the RCSB Protein Data Bank using a 4-letter PDB ID.
- **Ligand Input**: Supports uploading PDB, SDF, or MOL2 formats.
- **Automated Conversions**: Automatic, backend-handled Conversion from PDB to PDBQT for receptors, and SDF/MOL/SMILES to 3D PDBQT for ligands, leveraging OpenBabel.
- **Smart Docking Box Calculation**: Automatically calculates the center and size of the Grid Box based on the uploaded ligand, allowing for semi-blind and guided docking. Includes manual bounding box overrides.
- **Engine Selection**: Toggle between established docking engines like AutoDock Vina, Smina, GNINA, QVina, and LeDock.

## 2. Batch Docking (Combinatorial Screen)
- **High-Throughput Approach**: Perform M x N combinatorial screening of multiple receptors against a zip file containing multiple ligands.
- **Cloud/Backend Delegation**: Submits batch tasks to the backend queue. Includes features like:
  - Background ZIP extraction and validation.
  - Multi-threaded or queued execution of docking operations.
  - Generates comprehensive result summaries in CSV format.
  - Allows bulk download of docked poses.
- **Resource Constraints (Student Guard)**: Limits the batch size to 5 ligands and caps CPU usage to 2 cores for fairness in shared environments.

## 3. Advanced Chemical Intelligence
- **Database Fetching**:
  - Direct integration with **PubChem** API for searching compounds by name (e.g., "Aspirin") or CID.
  - Direct integration with **RCSB PDB** API for fetching receptor structures and metadata.
- **On-the-fly Generation**: Employs an RDKit.js WASM service to:
  - Generate 3D standard conformers from SMILES strings or 2D SDF outputs.
  - Calculate intrinsic molecular properties: Molecular Weight, logP, TPSA, H-Bond Acceptors/Donors, Rotatable Bonds.
  - Draw 2D SVG molecular depictions.

## 4. Rich 3D Visualization
- **Real-time Engine**: Employs `3Dmol.js` for lightweight, high-performance visualization of receptors and ligands directly in the browser.
- **Multi-view Modes**: Toggle between different rendering styles—Cartoon, Sticks, and VDW Surfaces.
- **Interactive Inspection**: Compare different binding modes (poses) from the same docking job instantly without reloading.
- **Visual Grid Overlay**: Projects the defined docking grid box dimensions dynamically over the receptor molecule.

## 5. Session and Project Management
- **Persistence**: Employs a local SQLite or filesystem-based `ProjectManager` mechanism on the backend to record "Missions" (sessions), including inputs, configuration parameters, and the output score file.
- **Downloadable Reports**: Download structured `.csv` reports of binding affinities and RMDS values, or the raw `.pdbqt` files for external analysis in tools like PyMOL or Discovery Studio.

## 6. Apple-Grade Aesthetics
- **Theme Support**: High-contrast Light Mode and sleak Dark Mode toggles.
- **Sidebar Navigation**: Expandable/collapsible sidebar with quick-access tabs for different workflow stages like Prep, Input, Batch, Running, and Output.
