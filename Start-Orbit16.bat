```bat
@echo off
setlocal EnableExtensions
title Orbit16 Studio Launcher

REM ============================================
REM Orbit16 Studio - Reliable Windows Launcher
REM ============================================

set "ROOT=E:\audio\16-d"
set "FRONTEND=%ROOT%\frontend"
set "BACKEND=%ROOT%\backend"
set "URL=http://127.0.0.1:5173"
set "BACKEND_URL=http://127.0.0.1:8000"

echo.
echo  ==========================================
echo          ORBIT16 STUDIO LAUNCHER
echo  ==========================================
echo.

REM Check project folders
if not exist "%BACKEND%\app\main.py" (
    echo [ERROR] Backend entry point not found:
    echo %BACKEND%\app\main.py
    pause
    exit /b 1
)

if not exist "%FRONTEND%\package.json" (
    echo [ERROR] Frontend package.json not found:
    echo %FRONTEND%\package.json
    pause
    exit /b 1
)

REM Check Python environment
if not exist "%ROOT%\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found.
    echo Expected: %ROOT%\.venv
    pause
    exit /b 1
)

REM Check Node.js and npm
where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is missing from PATH.
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is missing from PATH.
    pause
    exit /b 1
)

REM Check whether dependencies need installation
echo [1/5] Checking frontend dependencies...

if not exist "%FRONTEND%\node_modules\vite" (
    echo Installing frontend dependencies.
    echo This may take a few minutes the first time.
    pushd "%FRONTEND%"
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        popd
        pause
        exit /b 1
    )
    popd
)

REM Start backend in a separate terminal
echo.
echo [2/5] Starting backend...

start "Orbit16 Backend" cmd.exe /k "cd /d E:\audio\16-d && .venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000"

REM Start frontend in a separate terminal
echo [3/5] Starting frontend...

start "Orbit16 Frontend" cmd.exe /k "cd /d E:\audio\16-d\frontend && npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort"

REM Wait for Vite to respond
echo.
echo [4/5] Waiting for Vite to start...
echo Please keep the server windows open.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ready=$false; for($i=0; $i -lt 60; $i++) { try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -TimeoutSec 2 -UseBasicParsing; if($r.StatusCode -eq 200) { $ready=$true; break } } catch {}; Start-Sleep -Seconds 2 }; if($ready) { exit 0 } else { exit 1 }"

if errorlevel 1 goto FRONTEND_ERROR

REM Open browser only after Vite responds
echo.
echo [5/5] Opening Orbit16 Studio...
start "" "%URL%"

echo.
echo  ==========================================
echo       ORBIT16 STUDIO LAUNCH COMPLETE
echo  ==========================================
echo.
echo  Frontend: %URL%
echo  Backend:  %BACKEND_URL%
echo.
echo  Keep both server windows open.
echo.
pause
exit /b 0

:FRONTEND_ERROR
echo.
echo [ERROR] Vite did not respond within 120 seconds.
echo.
echo Check the "Orbit16 Frontend" terminal window.
echo Look for TypeScript, Babel, npm, or port errors.
echo.
echo If port 5173 is already occupied, close the
echo other Vite instance and run this launcher again.
echo.
pause
exit /b 1
```