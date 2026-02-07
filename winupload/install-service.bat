@echo off
setlocal

rem === Config ===
set WATCH_DIR=C:\Users\%USERNAME%\Pictures\摄影照片.library
set MODE=incremental
set SERVICE_NAME=MomentPhotosUploader
set DISPLAY_NAME=MomentPhotos Upload Watcher

rem === Resolve paths ===
set SCRIPT_DIR=%~dp0
set POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
set TASK_ACTION="%POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%watch-upload.ps1" -WatchDir "%WATCH_DIR%" -Mode "%MODE%"

rem === Create scheduled task to run at logon ===
schtasks /Create /F /SC ONLOGON /TN "%SERVICE_NAME%" /TR %TASK_ACTION% /RL HIGHEST

echo Installed startup task: %SERVICE_NAME%
pause
