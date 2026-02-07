@echo off
setlocal

set SERVICE_NAME=MomentPhotosUploader

schtasks /Delete /F /TN "%SERVICE_NAME%"

echo Removed startup task: %SERVICE_NAME%
pause
