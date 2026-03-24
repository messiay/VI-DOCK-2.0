
@echo off
title VI DOCK Pro Environment Test
echo ===================================================
echo    VI DOCK Pro - Environment Check
echo ===================================================
echo.
echo Running diagnostic tests for Backend environment...
cd backend
if exist ".venv\Scripts\python.exe" (
    call ".venv\Scripts\python.exe" debug_tests\test_environment.py
) ELSE (
    echo [ERROR] No local .venv found in backend directory.
    python debug_tests\test_environment.py
)

echo.
echo ---------------------------------------------------
echo.
echo Testing API Connectivity (Mock)...
if exist ".venv\Scripts\python.exe" (
    call ".venv\Scripts\python.exe" debug_tests\test_api.py
) ELSE (
    python debug_tests\test_api.py
)

echo.
pause
