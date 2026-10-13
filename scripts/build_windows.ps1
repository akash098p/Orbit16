$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is required. Install Python 3.12 x64 and ensure it is on PATH." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js/npm is required to build the UI." }
if (-not (Test-Path ".venv\Scripts\python.exe")) { python -m venv .venv }
$Py = Join-Path $Root ".venv\Scripts\python.exe"
& $Py -m pip install --upgrade pip
& $Py -m pip install -r backend/requirements.txt pyinstaller
Push-Location frontend
try {
    if (Test-Path "package-lock.json") { npm ci } else { npm install }
    npm run build
} finally { Pop-Location }
if (-not (Test-Path "frontend\dist\index.html")) { throw "Frontend build did not produce frontend/dist/index.html." }
& $Py -m PyInstaller --noconfirm --clean desktop/orbit16.spec
Write-Host ""
Write-Host "Build complete: dist\Orbit16Studio\Orbit16Studio.exe"
Write-Host "FFmpeg is an external dependency; see docs/DISTRIBUTION.md before redistributing."
