# Detiene el kiosco: el supervisor, PHP y Edge.

$WindowsDir = $PSScriptRoot
$KioscoDir = Split-Path $WindowsDir -Parent

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "powershell.exe" -and $_.CommandLine -like "*iniciar.ps1*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "php.exe" -and $_.ExecutablePath -like "$KioscoDir*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Kiosco detenido. Para volver a abrirlo usa iniciar.bat o reinicia la computadora."
