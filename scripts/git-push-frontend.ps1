# Helper script to initialize git and push the frontend to GitHub
# Usage: Open the VS Code integrated terminal at the project root and run:
#   .\scripts\git-push-frontend.ps1

param(
    [string]$RemoteUrl = "https://github.com/Simokouidi/electrix-crm-frontend.git"
)

function Test-Git {
    try {
        git --version | Out-Null
        return $true
    } catch {
        Write-Host "Git is not installed. Please install Git and rerun this script: https://git-scm.com/downloads" -ForegroundColor Red
        return $false
    }
}

if (-not (Test-Git)) { exit 1 }

Write-Host "Initializing git repository and pushing to: $RemoteUrl" -ForegroundColor Cyan

if (-not (Test-Path .git)) {
    git init
}

git add .

# Use a safe commit message
$commitMsg = Read-Host "Commit message (default: 'first commit')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = "first commit" }

git commit -m "$commitMsg" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit may have failed (no changes staged) or git user/email not configured. Trying to set default user." -ForegroundColor Yellow
    git config user.name "Your Name"
    git config user.email "you@example.com"
    git commit -m "$commitMsg"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No changes to commit." -ForegroundColor Yellow
    }
}

git branch -M main

# Add remote (replace if exists)
$existing = git remote get-url origin 2>$null
if ($existing) {
    Write-Host "Remote 'origin' already exists (" + $existing + "). Removing and re-adding." -ForegroundColor Yellow
    git remote remove origin
}

git remote add origin $RemoteUrl

Write-Host "Pushing to origin main (you may be prompted for credentials)" -ForegroundColor Green

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push successful. Refresh your GitHub repository page to see files." -ForegroundColor Green
} else {
    Write-Host "Push failed. If you're using 2FA/GitHub, create a Personal Access Token (PAT) and use it as the password, or run 'gh auth login' to authenticate via GitHub CLI." -ForegroundColor Red
}
