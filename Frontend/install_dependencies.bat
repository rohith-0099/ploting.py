@echo off
echo =========================================
echo Installing Dependencies for MECON Platform
echo =========================================

echo [1/3] Installing Backend Dependencies...
cd %~dp0\backend
call npm install

echo [2/3] Installing Frontend Dependencies...
cd %~dp0\frontend
call npm install

echo [3/3] Installing ML Engine Dependencies...
cd %~dp0\ml-engine
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call .\venv\Scripts\activate
pip install -r requirements.txt

echo.
echo All dependencies installed!
echo You can now double-click 'start_servers.bat' to run everything.
echo.
pause
