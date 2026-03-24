# Usage Guide

## Overview

VI DOCK Pro is a molecular docking application that connects to a FastAPI backend for AutoDock Vina computations. The frontend provides an intuitive interface while the backend handles the heavy docking calculations.

## Workflow

### Step 1: Prepare Your Molecules

**Receptor (Protein)**
- Enter a **PDB ID** (e.g., `1HSG`) to fetch from RCSB database
- Or upload a `.pdb` file directly

**Ligand (Small Molecule)**
- Enter a **PubChem CID** to fetch from PubChem
- Enter a **SMILES** string for instant 3D generation
- Or upload a `.pdbqt`, `.sdf`, or `.mol2` file

### Step 2: Configure the Grid Box

The grid box defines the search space for docking:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `center_x/y/z` | Box center coordinates | Auto-calculated |
| `size_x/y/z` | Box dimensions (Å) | 20×20×20 |
| `exhaustiveness` | Search thoroughness | 8 |

**Tips:**
- Smaller boxes = faster docking
- Use `exhaustiveness` of 1-4 for quick tests
- Use `exhaustiveness` of 8-32 for production runs

### Step 3: Run Docking

1. Click **"Start Docking"**
2. Watch progress in the Mission Log
3. Results appear in the Output panel

### Step 4: Analyze Results

The output table shows:
- **Pose**: Conformational model number
- **Affinity**: Binding energy (kcal/mol) — more negative = stronger binding
- **RMSD l.b. / u.b.**: Root-mean-square deviation from best pose

Click any pose to visualize it in 3D.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `R` | Reset view |
| `Space` | Toggle rotation |
| `+/-` | Zoom in/out |

## Supported File Formats

| Format | Extension | Use For |
|--------|-----------|---------|
| PDB | `.pdb` | Receptors |
| PDBQT | `.pdbqt` | Both |
| SDF | `.sdf` | Ligands |
| MOL2 | `.mol2` | Ligands |
| SMILES | (text) | Ligands |
