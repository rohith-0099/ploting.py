@echo off
echo =========================================
echo Starting MECON AI-Driven Platform Servers
echo =========================================

echo.
echo [1/3] Starting Python ML Engine (Port 5000)...
start cmd /k "cd %~dp0\ml-engine && .\venv\Scripts\activate && python app.py"

echo [2/3] Starting Node.js Backend (Port 4000)...
start cmd /k "cd %~dp0\backend && node server.js"

echo [3/3] Starting React Frontend (Port 5173)...
start cmd /k "cd %~dp0\frontend && npm run dev"

echo.
echo All services are launching in separate windows!
echo You can access the dashboard at: http://localhost:5173/
echo.
pause
