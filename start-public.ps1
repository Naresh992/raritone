# Raritone Live VTO - one-command public launcher (Option A: quick tunnel)
# Starts: FastAPI :8000, Next.js :3000, cloudflared quick tunnel -> public HTTPS URL
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$logDir = Join-Path $env:TEMP "opencode"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Ensure-Port($port, $name, $file, $args) {
  $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listening) { Write-Host "[ok] $name already on :$port"; return }
  Write-Host "[..] starting $name on :$port"
  Start-Process -FilePath $file -ArgumentList $args -WorkingDirectory $cwd -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "$name.log") -RedirectStandardError (Join-Path $logDir "$name.err.log")
}

$cwd = Join-Path $root "backend"
Ensure-Port 8000 "backend" "python" "-m uvicorn app.main:app --host 127.0.0.1 --port 8000"
$cwd = Join-Path $root "frontend"
Ensure-Port 3000 "frontend" "cmd" "/c npx next dev -p 3000 > `"$logDir\frontend.log`" 2>&1"

# wait for frontend
foreach ($i in 1..30) {
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { break }
  Start-Sleep -Seconds 2
}

# kill old tunnel if any, start fresh (URL changes each start)
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$cfLog = Join-Path $logDir "cf.log"
Remove-Item $cfLog, "$cfLog.err" -ErrorAction SilentlyContinue
Start-Process -FilePath $cfExe -ArgumentList "tunnel --url http://localhost:3000 --no-autoupdate" `
  -WindowStyle Hidden -RedirectStandardOutput $cfLog -RedirectStandardError "$cfLog.err"

$url = $null
foreach ($i in 1..20) {
  Start-Sleep -Seconds 2
  foreach ($f in @("$cfLog.err", $cfLog)) {
    if (Test-Path $f) {
      $m = Select-String -Path $f -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches
      if ($m) { $url = $m[0].Matches[0].Value; break }
    }
  }
  if ($url) { break }
}

if ($url) {
  Write-Host ""
  Write-Host "PUBLIC URL (open on any device, camera needs HTTPS):"
  Write-Host "  $url/live-try-on"
  Write-Host ""
  Write-Host "Keep this PC running. URL changes every restart. Ctrl+C stops nothing (detached)."
} else {
  Write-Host "Tunnel failed to start - see $logDir\cf.log.err"
}
