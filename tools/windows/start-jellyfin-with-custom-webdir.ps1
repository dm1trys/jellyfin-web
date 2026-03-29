$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$distDir = Join-Path $repoRoot "dist"
$runtimeRoot = Join-Path $repoRoot ".runtime-jellyfin"
$dataDir = Join-Path $runtimeRoot "data"
$configDir = Join-Path $runtimeRoot "config"
$cacheDir = Join-Path $runtimeRoot "cache"
$logDir = Join-Path $runtimeRoot "log"
$stdoutLog = Join-Path $logDir "stdout.log"
$stderrLog = Join-Path $logDir "stderr.log"
$jellyfinExe = "C:\Program Files\Jellyfin\Server\jellyfin.exe"
$port = 8097

if (-not (Test-Path $jellyfinExe)) {
    throw "Jellyfin is not installed at $jellyfinExe"
}

if (-not (Test-Path (Join-Path $distDir "index.html"))) {
    throw "Build output not found in $distDir. Run 'npm run build:production' first."
}

foreach ($path in @($dataDir, $configDir, $cacheDir, $logDir)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "A Jellyfin instance already appears to be listening on port $port."
    exit 0
}

$env:ASPNETCORE_URLS = "http://127.0.0.1:$port"

$arguments = @(
    "--datadir", $dataDir,
    "--configdir", $configDir,
    "--cachedir", $cacheDir,
    "--logdir", $logDir,
    "--webdir", $distDir,
    "--published-server-url", "http://127.0.0.1:$port"
)

$process = Start-Process -FilePath $jellyfinExe -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
Write-Output "Started Jellyfin with custom webdir on http://127.0.0.1:$port (PID $($process.Id))"
