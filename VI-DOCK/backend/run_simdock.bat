@echo off
REM Run VI DOCK Pro 3.1
REM Portable launcher - finds Python automatically
set PYTHONPATH=%~dp0

echo Starting VI DOCK Pro 3.1...

REM 1. Try common Conda paths (Preferred for VI DOCK reliability)
if exist "%USERPROFILE%\Miniconda3\python.exe" (
    echo Using Miniconda Python...
    set "PATH=%USERPROFILE%\Miniconda3;%USERPROFILE%\Miniconda3\Library\bin;%USERPROFILE%\Miniconda3\Scripts;%PATH%"
    "%USERPROFILE%\Miniconda3\python.exe" "%~dp0main.py" %*
) ELSE (
    if exist "%USERPROFILE%\anaconda3\python.exe" (
        echo Using Anaconda Python...
        set "PATH=%USERPROFILE%\anaconda3;%USERPROFILE%\anaconda3\Library\bin;%USERPROFILE%\anaconda3\Scripts;%PATH%"
        "%USERPROFILE%\anaconda3\python.exe" "%~dp0main.py" %*
    ) ELSE (
        REM 2. Fallback to generic system Python
        where python >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            echo Using system Python in PATH...
            python "%~dp0main.py" %*
        ) ELSE (
            echo [ERROR] Python not found! Please install Python 3.9+ or Miniconda.
            echo Expected locations: %USERPROFILE%\Miniconda3, %USERPROFILE%\anaconda3, or PATH
            pause
            exit /b 1
        )
    )
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application crashed or exited with an error.
    pause
)
