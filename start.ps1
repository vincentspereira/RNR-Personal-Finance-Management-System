# Start PFMS locally without Docker (Windows PowerShell)
# Prerequisites: Node.js 20+, PostgreSQL 16+

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '=== PFMS Local Development Setup ===' -ForegroundColor Cyan

# Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is not installed. Install from https://nodejs.org/'
  exit 1
}

# Check PostgreSQL
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Warning 'psql not found in PATH. Ensure PostgreSQL is installed and accessible.'
}

# Create .env if missing
$EnvPath = Join-Path $ScriptDir '.env'
$EnvExample = Join-Path $ScriptDir '.env.example'
if (-not (Test-Path $EnvPath) -and (Test-Path $EnvExample)) {
  Copy-Item $EnvExample $EnvPath
  Write-Host 'Created .env from .env.example - edit it with your API keys' -ForegroundColor Yellow
}

# Optionally provision database
$create = Read-Host 'Create local pfms database and user? (y/n)'
if ($create -match '^[Yy]') {
  & psql -U postgres -c "CREATE USER pfms WITH PASSWORD 'pfms_password';" 2>$null
  & psql -U postgres -c "CREATE DATABASE pfms OWNER pfms;" 2>$null
  & psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE pfms TO pfms;" 2>$null
  Write-Host "Database 'pfms' provisioned." -ForegroundColor Green
}

# Backend
Push-Location (Join-Path $ScriptDir 'backend')
Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan
npm install
Write-Host 'Running migrations...' -ForegroundColor Cyan
npm run migrate
Write-Host 'Building backend...' -ForegroundColor Cyan
npm run build

Write-Host 'Starting backend on http://localhost:5000 ...' -ForegroundColor Green
$env:DATABASE_URL = 'postgresql://pfms:pfms_password@localhost:5432/pfms'
$Backend = Start-Process -FilePath node -ArgumentList 'dist/server.js' -PassThru -NoNewWindow
Pop-Location

Start-Sleep -Seconds 3

# Frontend
Push-Location (Join-Path $ScriptDir 'frontend')
Write-Host 'Installing frontend dependencies...' -ForegroundColor Cyan
npm install
Write-Host 'Starting frontend dev server on http://localhost:5173 ...' -ForegroundColor Green
npm run dev
Pop-Location

# When the dev server exits, stop the backend too.
if ($Backend -and -not $Backend.HasExited) {
  Stop-Process -Id $Backend.Id -Force
}
