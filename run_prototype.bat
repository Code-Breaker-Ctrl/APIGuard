@echo off
echo ========================================================
echo   APIGuard - Graph-Guided BOLA Detection Engine
echo   Hack-O-Relay 6.0 ^| GDG DCE ^| Team Wasabi
echo ========================================================
echo.
echo [1/2] Starting APIGuard FastAPI Engine on http://127.0.0.1:8000 ...
start "APIGuard Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting APIGuard UI Dashboard on http://127.0.0.1:5173 ...
start "APIGuard Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Done! Opening your browser at http://127.0.0.1:5173 ...
timeout /t 3 >nul
start http://127.0.0.1:5173
