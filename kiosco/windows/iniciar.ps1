# Arranca el kiosco y lo mantiene funcionando:
#   - Servidor local PHP en http://127.0.0.1:17406
#   - Proceso de sincronización (worker.php)
#   - Microsoft Edge en modo kiosco
# Si alguno se cierra, lo vuelve a abrir.

$ErrorActionPreference = "Continue"

$WindowsDir = $PSScriptRoot
$KioscoDir = Split-Path $WindowsDir -Parent
$ProjectDir = Split-Path $KioscoDir -Parent
$PhpExe = Join-Path $KioscoDir "php\php.exe"
$PhpIni = Join-Path $KioscoDir "php\php.ini"
$Port = 17406
$Url = "http://127.0.0.1:$Port/"
$LogDir = Join-Path $env:ProgramData "KaluzKiosco"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "iniciar.log"

function Write-Log($message) {
    Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format "s"), $message)
}

# Evita que corran dos copias de este script.
$mutex = New-Object System.Threading.Mutex($false, "Local\KaluzKioscoIniciar")
if (-not $mutex.WaitOne(0)) { exit }

$edgeCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$Edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

function Start-Php($arguments) {
    return Start-Process -FilePath $PhpExe -ArgumentList $arguments -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
}

function Test-Server {
    try {
        $response = Invoke-WebRequest -Uri ($Url + "local-api/health") -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

$server = $null
$worker = $null
$browser = $null
$lastBrowserLaunch = [DateTime]::MinValue
# Perfil propio de Edge: así el kiosco es una ventana independiente aunque Edge ya esté abierto.
$EdgeProfile = Join-Path $LogDir "edge-perfil"

Write-Log "Iniciando kiosco."

while ($true) {
    if ($server -eq $null -or $server.HasExited) {
        Write-Log "Iniciando servidor local."
        $server = Start-Php @("-c", "`"$PhpIni`"", "-S", "127.0.0.1:$Port", "-t", "`"$ProjectDir`"", "`"$KioscoDir\router.php`"")
        Start-Sleep -Seconds 2
    }

    if ($worker -eq $null -or $worker.HasExited) {
        Write-Log "Iniciando sincronización."
        $worker = Start-Php @("-c", "`"$PhpIni`"", "`"$KioscoDir\worker.php`"")
    }

    $browserClosed = ($browser -eq $null -or $browser.HasExited)
    $canRelaunch = ((Get-Date) - $lastBrowserLaunch).TotalSeconds -ge 30
    if ($browserClosed -and $canRelaunch -and $Edge) {
        if (Test-Server) {
            $lastBrowserLaunch = Get-Date
            Write-Log "Abriendo Edge en modo kiosco."
            $browser = Start-Process -FilePath $Edge -PassThru -ArgumentList @(
                "--kiosk", $Url,
                "--user-data-dir=`"$EdgeProfile`"",
                "--edge-kiosk-type=fullscreen",
                "--no-first-run",
                "--autoplay-policy=no-user-gesture-required"
            )
        }
    }

    Start-Sleep -Seconds 5
}
