@echo off
echo ====================================================
echo  MECON Phase 5 - Backend Startup
echo ====================================================
echo.
echo [1/2] Installing Python dependencies...
cd /d d:\MECON\phase5\backend
pip install flask flask-cors pandas numpy --quiet
echo.
echo [2/2] Starting Flask API on http://localhost:5000
python server.py
pause
