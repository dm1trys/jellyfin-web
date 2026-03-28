$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$nodeExe = "C:\Program Files\nodejs\node.exe"
$scriptPath = Join-Path $repoRoot "serve-dist.js"
$logDir = Join-Path $repoRoot ".runtime-web"
$stdoutLog = Join-Path $logDir "stdout.log"
$stderrLog = Join-Path $logDir "stderr.log"
$port = 8097

if (-not (Test-Path $nodeExe)) {
    throw "Node.js is not installed at $nodeExe"
}

if (-not (Test-Path (Join-Path $repoRoot "dist\\index.html"))) {
    throw "dist\\index.html not found. Run npm run build:production first."
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "Web client is already listening on http://127.0.0.1:$port"
    exit 0
}

$process = Start-Process -FilePath $nodeExe -ArgumentList $scriptPath -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
Write-Output "Started Jellyfin web client on http://127.0.0.1:$port (PID $($process.Id))"
