<#
.SYNOPSIS
  GovGuide AI - reliable local startup script (Windows PowerShell).
.DESCRIPTION
  Verifies dependencies and environment, starts the FastAPI backend and the
  Vite frontend, confirms each service is actually reachable (not just "started"),
  and prints the real local URLs. Safe to re-run: it detects already-running
  services and avoids starting duplicates.
#>

$ErrorActionPreference = "Stop"

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Backend   = Join-Path $Root "backend"
$Frontend  = Join-Path $Root "frontend"
$BackendPort  = 8000
$FrontendPort = 5173
$BackendUrl   = "http://127.0.0.1:$BackendPort"
$FrontendUrl  = "http://localhost:$FrontendPort"

function Test-Port($port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $port); $c.Close(); return $true
  } catch { return $false }
}

Write-Host "=== GovGuide AI startup ===" -ForegroundColor Cyan

# 1. Verify required tooling
Write-Host "`n[1/5] Checking dependencies..."
$py = Join-Path $Backend "venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Host "  Backend virtualenv missing at: $py" -ForegroundColor Yellow
  Write-Host "  Create it with:  cd backend; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt"
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Node.js not found on PATH. Install Node 18+." -ForegroundColor Red; exit 1
}
$nodeModules = Join-Path $Frontend "node_modules"
if (-not (Test-Path $nodeModules)) {
  Write-Host "  Frontend packages missing. Running npm install (first time only)..." -ForegroundColor Yellow
  Push-Location $Frontend; npm install; Pop-Location
}
Write-Host "  OK: python venv, node, frontend deps present."

# 2. Verify environment file
Write-Host "`n[2/5] Checking environment configuration..."
$envFile = Join-Path $Backend ".env"
if (-not (Test-Path $envFile)) {
  $example = Join-Path $Backend ".env.example"
  Copy-Item $example $envFile
  Write-Host "  Created backend\.env from .env.example (dev defaults). Edit for real secrets." -ForegroundColor Yellow
} else {
  Write-Host "  backend\.env present."
}

# 3. Start backend (skip if already running)
Write-Host "`n[3/5] Starting backend API..."
if (Test-Port $BackendPort) {
  Write-Host "  Backend already listening on $BackendUrl - reusing it." -ForegroundColor DarkGray
} else {
  Push-Location $Backend
  Start-Process -FilePath $py -ArgumentList "-m","uvicorn","main:app","--host","127.0.0.1","--port",$BackendPort `
    -WindowStyle Minimized
  Pop-Location
  # Wait for health
  $ok = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 700
    try {
      $h = Invoke-RestMethod -Uri "$BackendUrl/health" -TimeoutSec 2
      if ($h.status -eq "ok") { $ok = $true; break }
    } catch {}
  }
  if ($ok) { Write-Host "  Backend healthy (DB: $($h.database))." }
  else { Write-Host "  ERROR: Backend did not become healthy. Check the backend window for errors." -ForegroundColor Red; exit 1 }
}

# 4. Start frontend (skip if already running)
Write-Host "`n[4/5] Starting frontend dev server..."
if (Test-Port $FrontendPort) {
  Write-Host "  Frontend already listening on $FrontendUrl - reusing it." -ForegroundColor DarkGray
} else {
  Push-Location $Frontend
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev" -WindowStyle Minimized
  Pop-Location
  $ok2 = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 700
    if (Test-Port $FrontendPort) { $ok2 = $true; break }
  }
  if (-not $ok2) { Write-Host "  ERROR: Frontend did not start. Check the frontend window." -ForegroundColor Red; exit 1 }
}

# 5. Confirm frontend can reach backend via the Vite /api proxy
Write-Host "`n[5/5] Verifying frontend -> backend connectivity..."
try {
  $probe = Invoke-RestMethod -Uri "$FrontendUrl/api/schemes" -TimeoutSec 5
  $count = ($probe | Measure-Object).Count
  Write-Host "  OK: frontend proxy reached backend and returned $count schemes."
} catch {
  Write-Host "  WARNING: could not verify the proxy path: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== GovGuide AI is running ===" -ForegroundColor Green
Write-Host "  Frontend:    $FrontendUrl"
Write-Host "  Backend API: $BackendUrl"
Write-Host "  API docs:    $BackendUrl/docs"
Write-Host "  Health:      $BackendUrl/health"
