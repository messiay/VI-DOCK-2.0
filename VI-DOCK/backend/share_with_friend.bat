@echo off
set "NGROK_EXE=ngrok.exe"

echo ========================================================
echo   VI DOCK Pro - Internet Sharing Helper
echo ========================================================
echo.
echo [INFO] This script will:
echo        1. Start the VI DOCK API Server (Your Laptop becomes the Server)
echo        2. Start the Internet Tunnel (So your friend can connect)
echo.

echo [Step 0] Cleaning up old processes...
taskkill /F /IM python.exe >nul 2>nul
taskkill /F /IM ngrok.exe >nul 2>nul
echo          Done.

echo [Step 1] Launching API Server (Port 8081)...
start "VI DOCK API Server" cmd /k "run_api_share.bat"
echo          Done. (Opened in new window)
echo.

echo [Step 2] Checking for Ngrok Tunnel Tool...

REM Check if ngrok is in the current folder
if exist "%NGROK_EXE%" (
    echo [OK] Found ngrok in this folder.
    goto START_TUNNEL
)

REM Check if ngrok is installed globally (e.g. via Store/Winget)
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Found ngrok in system path.
    set "NGROK_EXE=ngrok"
    goto START_TUNNEL
)

echo [ERROR] 'ngrok.exe' was NOT found.
echo.
echo ACTION REQUIRED:
echo Since you installed it via Store, try restarting this script first.
echo If it still fails, put the 'ngrok.exe' file in this folder manually.
echo.
pause
exit /b

:START_TUNNEL
echo [Step 3] Starting Tunnel on Port 8081...
echo.
echo ========================================================
echo   INSTRUCTIONS FOR YOU:
echo   1. The screen will turn black and show a status table.
echo   2. Look for the line starting with "Forwarding".
echo   3. It will look like:  https://random-name.ngrok-free.app
echo   4. COPY that link.
echo   5. Send this to your friend: "Open this link: <LINK>/docs"
echo ========================================================
echo.
echo Starting ngrok...
ngrok http 8081
