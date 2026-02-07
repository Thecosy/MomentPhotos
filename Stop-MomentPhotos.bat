@echo off
setlocal

rem Stop only node.exe processes using port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
  for /f "tokens=1" %%b in ('tasklist /FI "PID eq %%a" /FO CSV /NH') do (
    echo %%b | findstr /I /C:"node.exe" >nul
    if %errorlevel%==0 (
      taskkill /F /PID %%a >nul 2>&1
      echo Stopped node.exe PID %%a on port 3001.
    )
  )
)

echo Done.
pause
