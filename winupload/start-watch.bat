@echo off
setlocal

rem === Config ===
set WATCH_DIR=C:\Users\%USERNAME%\Pictures\摄影照片.library
set MODE=incremental

rem === Move to script directory ===
cd /d "%~dp0"

rem === Start PowerShell watcher ===
powershell -NoProfile -ExecutionPolicy Bypass -File ".\watch-upload.ps1" -WatchDir "%WATCH_DIR%" -Mode "%MODE%"

pause
