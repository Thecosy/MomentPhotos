@echo off
setlocal

cd /d C:\Users\%USERNAME%\Documents\GitHub\MomentPhotos\Momentography

set HOSTNAME=127.0.0.1
npm run dev -- --port 3001
