@echo off
title VI DOCK Pro Launcher
echo ===================================================
echo    VI DOCK Pro - Molecular Docking System
echo ===================================================
echo.
echo [1/3] Starting Backend Server...
start "VI DOCK Backend" cmd /k "cd backend && call run_api.bat"

echo [2/3] Starting Frontend Interface...
start "VI DOCK Frontend" cmd /k "npm run dev"

echo [3/3] Launching Browser...
timeout /t 5 >nul
start http://localhost:5173

echo.
echo System is running!
echo - Backend: http://127.0.0.1:8000/docs
echo - Frontend: http://localhost:5173
echo.
echo Don't close the popup terminal windows.
pause
