# Instalador del kiosco SM Kaluz.
# 1. Descarga PHP para Windows dentro de kiosco\php (no instala nada en el sistema).
# 2. Descarga los certificados raíz (cacert.pem) para conectarse por HTTPS.
# 3. Crea el acceso directo para que el kiosco arranque al iniciar sesión.
# 4. Abre el kiosco para capturar el código de activación.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PhpVersion = "8.3.14"
$PhpUrl = "https://downloads.php.net/~windows/releases/archives/php-$PhpVersion-nts-Win32-vs16-x64.zip"
$CaUrl = "https://curl.se/ca/cacert.pem"

$WindowsDir = $PSScriptRoot
$KioscoDir = Split-Path $WindowsDir -Parent
$ProjectDir = Split-Path $KioscoDir -Parent
$PhpDir = Join-Path $KioscoDir "php"
$PhpExe = Join-Path $PhpDir "php.exe"

Write-Host ""
Write-Host "=== Instalando kiosco SM Kaluz ===" -ForegroundColor Cyan
Write-Host "Carpeta del proyecto: $ProjectDir"

if (-not (Test-Path (Join-Path $ProjectDir "index.html"))) {
    throw "No encuentro index.html en $ProjectDir. La carpeta kiosco debe estar dentro del proyecto."
}

# 1. PHP
if (-not (Test-Path $PhpExe)) {
    Write-Host "Descargando PHP $PhpVersion..."
    $zip = Join-Path $env:TEMP "php-kiosco.zip"
    Invoke-WebRequest -Uri $PhpUrl -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $PhpDir -Force
    Remove-Item $zip
} else {
    Write-Host "PHP ya está instalado."
}

# PHP para Windows necesita el Visual C++ Redistributable.
& $PhpExe -v *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instalando Visual C++ Redistributable (requerido por PHP)..."
    $vc = Join-Path $env:TEMP "vc_redist.x64.exe"
    Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $vc -UseBasicParsing
    Start-Process -FilePath $vc -ArgumentList "/install", "/quiet", "/norestart" -Wait
    Remove-Item $vc
}

Copy-Item (Join-Path $WindowsDir "php.ini") (Join-Path $PhpDir "php.ini") -Force

# 2. Certificados raíz
Write-Host "Descargando certificados raíz..."
Invoke-WebRequest -Uri $CaUrl -OutFile (Join-Path $KioscoDir "cacert.pem") -UseBasicParsing

# Revisión rápida de que PHP tiene lo necesario.
$modules = & $PhpExe -c (Join-Path $PhpDir "php.ini") -m
foreach ($module in @("curl", "pdo_sqlite", "mbstring", "openssl")) {
    if ($modules -notcontains $module) {
        throw "A PHP le falta la extensión $module."
    }
}

# 3. Arranque automático al iniciar sesión
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Kiosco Kaluz.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $WindowsDir 'iniciar.ps1')`""
$shortcut.WorkingDirectory = $ProjectDir
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Host "Arranque automático configurado: $shortcutPath"

# 4. Abrir
Write-Host ""
Write-Host "Listo. Se abrirá el kiosco para capturar el código de activación." -ForegroundColor Green
Write-Host "Para salir del modo kiosco usa detener.bat (Alt+F4 lo vuelve a abrir)."
Start-Process powershell.exe -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$(Join-Path $WindowsDir 'iniciar.ps1')`""
