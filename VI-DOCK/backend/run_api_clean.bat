@echo off
REM Run VI DOCK Pro 3.1 API Server
set PYTHONPATH=%~dp0

echo Starting VI DOCK Pro API Server...
echo Access Docs at: http://127.0.0.1:8000/docs
echo.

REM 0. Check for local .venv (Best for development)
if exist "%~dp0.venv\Scripts\python.exe" (
    echo Using local .venv...
    call "%~dp0.venv\Scripts\python.exe" -m uvicorn api.main:app --host 127.0.0.1 --port 8000
) ELSE (
    REM 1. Try common Conda paths (Preferred for VI DOCK reliability)
    if exist "%USERPROFILE%\Miniconda3\python.exe" (
        echo Using Miniconda Python...
        set "PATH=%USERPROFILE%\Miniconda3;%USERPROFILE%\Miniconda3\Library\bin;%USERPROFILE%\Miniconda3\Scripts;%PATH%"
        call "%USERPROFILE%\Miniconda3\python.exe" -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
    ) ELSE (
        if exist "%USERPROFILE%\anaconda3\python.exe" (
            echo Using Anaconda Python...
            set "PATH=%USERPROFILE%\anaconda3;%USERPROFILE%\anaconda3\Library\bin;%USERPROFILE%\anaconda3\Scripts;%PATH%"
            call "%USERPROFILE%\anaconda3\python.exe" -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
        ) ELSE (
            REM 2. Fallback to generic system Python
            where python >nul 2>nul
            if %ERRORLEVEL% EQU 0 (
                echo Using system Python in PATH...
                call python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
            ) ELSE (
                echo [ERROR] Python not found! Please install Python 3.9+ or Miniconda.
                echo Expected locations: %USERPROFILE%\Miniconda3, %USERPROFILE%\anaconda3, or PATH
                pause
                exit /b 1
            )
        )
    )
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] API Server crashed.
    pause
)
