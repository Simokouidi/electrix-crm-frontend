# Script to remove large files (like Chromium) from the current commit and push to remote
# WARNING: This script will rewrite local commits and may force-push to remote. Only run if you understand git history rewriting.

function Use-Git {
    try { git --version | Out-Null; return $true } catch { Write-Host "Git not found." -ForegroundColor Red; return $false }
}
if (-not (Use-Git)) { exit 1 }

Write-Host "This script will:
 - remove node_modules and other large files from the index
 - create a new commit without those files
 - force-push to origin/main (required to overwrite the remote pre-receive rejection)
" -ForegroundColor Yellow

$confirm = Read-Host "Type 'YES' to continue"
if ($confirm -ne 'YES') { Write-Host "Aborted."; exit 0 }

# Ensure .gitignore contains node_modules
if (-not (Get-Content .gitignore | Select-String 'node_modules')) {
    Add-Content .gitignore "node_modules/"
    Write-Host "Added node_modules/ to .gitignore"
}

# Remove node_modules and any big files from the index
git rm -r --cached node_modules 2>$null

# Find large files staged in the last commit (over 50MB)
$large = git ls-tree -r --long HEAD | ForEach-Object {
    $parts = $_ -split '\s+'; if ($parts.Length -ge 4) { [PSCustomObject]@{ mode=$parts[0]; type=$parts[1]; sha=$parts[2]; size=[int]$parts[3]; file=$parts[4] } }
} | Where-Object { $_.size -gt 52428800 }

if ($large) {
    Write-Host "Found large files in commit, removing from index:" -ForegroundColor Yellow
    $large | ForEach-Object { Write-Host " - " + $_.file; git rm --cached "$($_.file)" }
}

# If there are changes, commit them
if (-not (git diff --cached --name-only)) {
    Write-Host "No tracked files to remove from index. Nothing to commit." -ForegroundColor Yellow
} else {
    git commit -m "chore: remove node_modules and large files before push"
}

# Finally push force
Write-Host "About to force-push to origin main. This will overwrite the remote branch. Continue? (y/n)" -ForegroundColor Red
$go = Read-Host
if ($go -ne 'y') { Write-Host "Aborted push."; exit 0 }

git push -f origin main

if ($LASTEXITCODE -eq 0) { Write-Host "Push succeeded." -ForegroundColor Green } else { Write-Host "Push failed. Copy the git output and paste here for diagnosis." -ForegroundColor Red }
