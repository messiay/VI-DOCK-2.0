import sys
import shutil
import os

print(f"Python: {sys.executable}")
print(f"Path: {sys.path}")

# Check executables
print(f"obabel in path: {shutil.which('obabel')}")
print(f"babel in path: {shutil.which('babel')}")

# Check Imports
try:
    import openbabel
    print("Module 'openbabel': Found")
except ImportError:
    print("Module 'openbabel': Not Found")

try:
    from rdkit import Chem
    print("Module 'rdkit': Found")
except ImportError:
    print("Module 'rdkit': Not Found")

# Check common paths
common = [
    r"C:\Program Files\OpenBabel-2.4.1\obabel.exe",
    r"C:\Program Files (x86)\OpenBabel-2.4.1\obabel.exe",
    os.path.expanduser(r"~\Miniconda3\Library\bin\obabel.exe"),
    os.path.expanduser(r"~\anaconda3\Library\bin\obabel.exe"),
]
for p in common:
    if os.path.exists(p):
        print(f"Found at: {p}")
