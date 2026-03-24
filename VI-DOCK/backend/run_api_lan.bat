@echo off
REM Run VI DOCK Pro API on All Network Interfaces (LAN Mode)
set PYTHONPATH=%~dp0

echo ========================================================
echo   VI DOCK Pro 3.1 - Public API Server
echo ========================================================
echo.
echo [INFO] This server is visible to other computers on your network.
echo [INFO] To connect, your friend needs your Local IP Address.
echo.
echo Finding your IP address...
ipconfig | findstr /i "IPv4"
echo.
echo Example usage for your friend: http://<YOUR_IP>:8000/docs
echo.

"C:\Users\user\Miniconda3\python.exe" -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server crashed.
    pause
)
