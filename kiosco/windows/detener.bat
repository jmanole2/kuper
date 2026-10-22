@echo off
rem Cierra el interactivo y el programa local (para dar mantenimiento).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0detener.ps1"
pause
