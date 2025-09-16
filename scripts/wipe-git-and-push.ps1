<#
Wipe local .git and re-init a clean repository, then push to the configured remote.
Usage (run in PowerShell from the project root):
  .\scripts\wipe-git-and-push.ps1
This script will delete local git history.
#>

param(
    [string]$RemoteUrl = 'https://github.com/Simokouidi/electrix-crm-frontend.git',
    [string]$Branch = 'main',
    [switch]$AutoConfirm
)

# Confirm
Write-Host "This will REMOVE your local .git folder and create a new clean repo, then push to $RemoteUrl on branch $Branch." -ForegroundColor Red
if (-not $AutoConfirm) {
    $ok = Read-Host "Type YES to continue"
    if ($ok -ne 'YES') { Write-Host 'Aborted.'; exit 0 }
} else {
    Write-Host "AutoConfirm enabled — continuing without interactive prompt." -ForegroundColor Yellow
}

# Ensure git present
try { git --version | Out-Null } catch { Write-Host 'Git is not installed or not in PATH. Install Git and retry.' -ForegroundColor Red; exit 1 }

# Create .gitignore per instructions
@"
# dependencies
node_modules/
.pnpm-store/
**/.local-chromium/
**/chrome-win/
**/Chromium.app/
# builds
dist/
build/
# env / local
.env
.env.*
*.local
# OS/IDE
.DS_Store
Thumbs.db
.vscode/
"@ | Out-File -Encoding utf8 .gitignore
Write-Host '.gitignore created/updated.' -ForegroundColor Green

# Remove .git
if (Test-Path '.git') {
    Write-Host 'Removing existing .git directory...' -ForegroundColor Yellow
    Remove-Item -Recurse -Force .git
}

# Re-init and push
Write-Host 'Initializing new git repository...' -ForegroundColor Cyan
git init

Write-Host 'Staging files (node_modules and ignored files are respected by .gitignore)...' -ForegroundColor Cyan
git add .

Write-Host 'Committing clean snapshot...' -ForegroundColor Cyan
git commit -m 'Initial clean commit (no node_modules or build artifacts)'
if ($LASTEXITCODE -ne 0) { Write-Host 'Commit failed. Ensure you have files to commit.' -ForegroundColor Red; exit 1 }

Write-Host "Creating branch $Branch..." -ForegroundColor Cyan
git branch -M $Branch

# Add remote
$remoteUrlExisting = $null
try { $remoteUrlExisting = git remote get-url origin 2>$null } catch { $remoteUrlExisting = $null }
if ($remoteUrlExisting) {
    Write-Host 'Remote origin already exists, removing and re-adding.' -ForegroundColor Yellow
    git remote remove origin
}

git remote add origin $RemoteUrl

Write-Host 'Pushing to remote (you may be prompted for credentials)...' -ForegroundColor Cyan
git push -u origin $Branch
if ($LASTEXITCODE -eq 0) { Write-Host 'Push successful.' -ForegroundColor Green } else { Write-Host 'Push failed. Copy the terminal output and paste it here so I can diagnose.' -ForegroundColor Red; exit 1 }
