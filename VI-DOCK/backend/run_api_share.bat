@echo off
REM Run VI DOCK Pro API on Port 8081 (Alternative Port)
set PYTHONPATH=%~dp0

echo Starting VI DOCK Pro API Server on Port 8081...
echo.

"C:\Users\user\Miniconda3\python.exe" -m uvicorn api.main:app --host 127.0.0.1 --port 8081

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] API Server crashed.
    pause
)
