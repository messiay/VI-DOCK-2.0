
# VI DOCK Pro 3.1 Refactoring & Testing Guide

This project has been updated to separate frontend/backend services and include modular tests.

## 🚀 Running the Services (Modular)

Instead of one script that runs everything and hides errors, use the following split scripts:

1.  **Run Backend (FastAPI):**
    Double-click `run_backend.bat` in the root folder.
    - This starts the API server on `http://127.0.0.1:8000`.
    - It uses the local `.venv` environment correctly.

2.  **Run Frontend (React/Vite):**
    Double-click `run_frontend.bat` in the root folder.
    - This starts the UI on `http://localhost:5173`.

## 🛠️ Debugging & Tests

If something fails, use the new diagnostic tools:

1.  **Verify Setup:**
    Double-click `verify_setup.bat`.
    - Checks Python environment (imports, config).
    - Checks API connectivity (pings backend).

2.  **Backend Debug Scripts:** located in `backend/debug_tests/`
    - `test_environment.py`: Verifies dependencies like RDKit, OpenBabel, etc.
    - `test_api.py`: Tests API endpoints directly without needing the frontend.

## ⚠️ Known Issues Fixed

- **Port 8000 Conflict:** The backend now checks and cleans up old processes before starting.
- **Syntax Error in `conversion.py`:** Duplicate code blocks removed.
- **Path Issues:** Scripts now correctly navigate to the `backend` directory.

## 📝 Configuration

Configuration is managed via `backend/config.json`. Use the `verify_setup.bat` script to validate it.
