# Helper PowerShell script to install Railway CLI and guide linking/deploy
# Usage: Open VS Code terminal (PowerShell) and run: .\scripts\railway-setup.ps1

Write-Host "Railway helper script: installing or checking Railway CLI..."

function Ensure-Node { 
    try {
        $node = & node -v 2>$null
        if ($LASTEXITCODE -ne 0) { throw "node not found" }
        Write-Host "Node is installed: $node"
        return $true
    } catch {
        Write-Host "Node is not installed. Please install Node.js (LTS) and npm from https://nodejs.org/ and rerun this script." -ForegroundColor Yellow
        return $false
    }
}

if (-not (Ensure-Node)) { exit 1 }

# Check railway CLI
$railway = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railway) {
    Write-Host "Railway CLI not found. Installing via npm (may require admin rights)..." -ForegroundColor Cyan
    npm install -g @railway/cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Railway CLI install failed. Please run 'npm install -g @railway/cli' manually." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Railway CLI is available. You can log in interactively." -ForegroundColor Green
$doLogin = Read-Host "Run 'railway login' now to authenticate? (y/n)"
if ($doLogin -eq 'y') { 
    try { railway login } catch { Write-Host "Failed to run 'railway login' — ensure CLI installed and network available." -ForegroundColor Red }
} else { Write-Host "Skipping 'railway login'." -ForegroundColor Yellow }

Write-Host "Now run one of the following interactively:" -ForegroundColor White
Write-Host "  railway init   # create or choose a Railway project" -ForegroundColor White
Write-Host "  railway link   # link to an existing Railway project" -ForegroundColor White
Write-Host "After linking, run 'railway up' to deploy." -ForegroundColor White

$choice = Read-Host "Would you like me to run 'railway init' now? (y/n)"
if ($choice -eq 'y') {
    try { railway init } catch { Write-Host "Failed to run 'railway init' — run it manually in your terminal." -ForegroundColor Red }
} else {
    Write-Host "Skipping 'railway init'. Use 'railway link' to attach to an existing project." -ForegroundColor Yellow
}

Write-Host "If you need to create services, open the Railway dashboard or use 'railway service' commands." -ForegroundColor Cyan
Write-Host "Remember: add a persistent volume for the whatsapp-bot service and set BOT_API_KEY in Railway Environment variables." -ForegroundColor Magenta
