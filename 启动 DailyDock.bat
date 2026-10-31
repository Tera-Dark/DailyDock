@echo off
cd /d "%~dp0"
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8765/"
python -m http.server 8765 --bind 127.0.0.1
pause
