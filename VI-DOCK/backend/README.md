# VI DOCK 3.1 - Backend Server 🧬

The backend for VI DOCK provides a high-performance REST API powered by FastAPI, and integrates directly with AutoDock Vina, RDKit, and Open Babel for molecular processing and docking.

## 🚀 How to Run the API Server

The frontend application (`simdock-pro/src`) expects this backend API to be running on `http://127.0.0.1:8000`.

### In VS Code Terminal:
1. Navigate to this `backend` directory:
   ```bash
   cd "d:\Amogh Projects\SIMDOCK\simdock-pro\backend"
   ```
2. Run the provided startup script:
   ```bash
   .\run_api_clean.bat
   ```

*The `run_api_clean.bat` script is designed to automatically locate your local Python virtual environment (`.venv`), Miniconda, or Anaconda installations to launch `uvicorn` correctly.*

### Manual Startup (Alternative):
If you prefer to start the server manually using your own Python environment:
```cmd
pip install -r requirements.txt
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

## 🖥️ Standalone GUI (Alternative Mode)

Aside from the browser-based platform, the backend also contains a legacy standalone Tkinter/ChimeraX GUI.
To launch the standalone GUI instead of the Web API:

```bash
.\run_simdock.bat
```
*(This requires UCSF ChimeraX to be installed for visualization).*

## 📦 Prerequisites

If your system doesn't have the required bioinformatics tools, the backend can often auto-download and configure them. However, you should broadly have:
1. **Python 3.9+** or **Miniconda**
2. **AutoDock Vina**
3. **Open Babel**