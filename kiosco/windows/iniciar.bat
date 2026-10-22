@echo off
rem Abre el kiosco manualmente (normalmente arranca solo al encender la computadora).
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"
