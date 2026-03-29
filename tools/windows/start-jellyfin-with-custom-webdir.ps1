$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$webClientScript = Join-Path $repoRoot "start-web-client.ps1"
$jellyfinServiceName = "JellyfinServer"
$backendPort = 8096
$webClientPort = 8097

if (-not (Test-Path (Join-Path $repoRoot "dist\\index.html"))) {
    throw "Build output not found in $repoRoot\\dist. Run 'npm run build:production' first."
}

$backendListening = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
if (-not $backendListening) {
    $service = Get-Service -Name $jellyfinServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "Jellyfin service '$jellyfinServiceName' was not found. Install/start Jellyfin first."
    }

    if ($service.Status -ne 'Running') {
        Start-Service -Name $jellyfinServiceName
    }

    $deadline = (Get-Date).AddSeconds(25)
    do {
        Start-Sleep -Seconds 1
        $backendListening = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
    } while (-not $backendListening -and (Get-Date) -lt $deadline)

    if (-not $backendListening) {
        throw "Jellyfin backend did not start on port $backendPort."
    }
}

& $webClientScript | Out-Null

$webClientListening = Get-NetTCPConnection -LocalPort $webClientPort -State Listen -ErrorAction SilentlyContinue
if (-not $webClientListening) {
    throw "Custom web client did not start on port $webClientPort."
}

Write-Output "Backend: http://127.0.0.1:$backendPort"
Write-Output "Custom web client: http://127.0.0.1:$webClientPort"
