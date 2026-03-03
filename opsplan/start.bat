@echo off
REM ============================================================
REM OpsPlan — Single Start Script
REM Starts both the FastAPI backend and React frontend
REM ============================================================

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║          OpsPlan — Starting            ║
echo  ╚═══════════════════════════════════════╝
echo.

REM Navigate to opsplan directory
cd /d %~dp0

REM Activate virtual environment
call .venv\Scripts\activate

echo [1/2] Starting backend (FastAPI + Uvicorn)...
start "OpsPlan Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && uvicorn api.main:app --reload"

REM Give backend a moment to start
timeout /t 3 /nobreak > nul

echo [2/2] Starting frontend (Vite dev server)...
start "OpsPlan Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo  ✓ Backend:  http://localhost:8000
echo  ✓ Frontend: http://localhost:5173
echo  ✓ Health:   http://localhost:8000/health
echo.
echo  Press any key to open the app in your browser...
pause > nul
start http://localhost:5173
