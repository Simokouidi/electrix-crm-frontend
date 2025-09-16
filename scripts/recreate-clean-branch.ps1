<#
PowerShell script to create a clean orphan branch (no history) containing the current working tree
excluding files in .gitignore (e.g., node_modules), then force-push it to origin/main.

Usage: Open PowerShell in the repo root and run:
    .\scripts\recreate-clean-branch.ps1

This will:
 - show large files currently in the index/HEAD
 - create an orphan branch `clean-main-temp`
 - add all files respecting .gitignore
 - commit a clean snapshot
 - force-push to origin/main (overwriting remote main)

Warning: This rewrites history on the remote. Only run if you understand force-push consequences.
#>

function Test-Git { 
    try { git --version | Out-Null; return $true } catch { Write-Host "Git not found." -ForegroundColor Red; return $false }
}
if (-not (Test-Git)) { exit 1 }

# Show top large files for user's awareness
Write-Host "Top large files currently in the repository (HEAD):" -ForegroundColor Cyan
git ls-tree -r --long HEAD 2>$null | ForEach-Object {
    $parts = $_ -split '\s+'; if ($parts.Length -ge 4) { [PSCustomObject]@{ size=[int]$parts[3]; file=$parts[4] } }
} | Sort-Object -Property size -Descending | Select-Object -First 10 | ForEach-Object { Write-Host ("{0,10:N0} bytes  {1}" -f $_.size, $_.file) }

Write-Host "\nEnsure your .gitignore includes node_modules/ and other build artifacts." -ForegroundColor Yellow
if (-not (Get-Content .gitignore | Select-String 'node_modules')) { Write-Host "node_modules/ not found in .gitignore - script will add it." -ForegroundColor Yellow }

$confirm = Read-Host "Type YES to create a clean orphan branch and force-push it to origin/main"
if ($confirm -ne 'YES') { Write-Host "Aborted by user."; exit 0 }

# Add node_modules to .gitignore if missing
if (-not (Get-Content .gitignore | Select-String 'node_modules')) {
    Add-Content .gitignore "node_modules/"
    Write-Host "Added node_modules/ to .gitignore"
}

# Ensure working tree is up to date (no unstaged deletions that would be lost)
Write-Host "Staging any local changes that are not in .gitignore (will include them in new commit)..." -ForegroundColor Cyan
git add .

# Create orphan branch
$orphan = 'clean-main-temp'
try { git rev-parse --verify $orphan 2>$null; if ($LASTEXITCODE -eq 0) { git branch -D $orphan } } catch { }

git checkout --orphan $orphan

# Clear the index and add files (respecting .gitignore)
git reset --mixed

# Now add files; node_modules and ignored files won't be added
git add .

# Commit
$commitMsg = "chore: clean snapshot - remove node_modules & large binaries"
git commit -m "$commitMsg"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. Aborting." -ForegroundColor Red
    # Try to return to previous branch
    git checkout -
    exit 1
}

# Force-push the orphan branch to overwrite origin/main
Write-Host "Force-pushing clean branch $orphan to origin/main (this will overwrite remote history)." -ForegroundColor Red

git push -f origin "$orphan:main"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Force-push succeeded. Cleaning up local branch and switching to main." -ForegroundColor Green
    git checkout main 2>$null
    if ($LASTEXITCODE -ne 0) { git checkout -b main }
    # Delete the temporary orphan branch
    git branch -D $orphan 2>$null
    Write-Host "Done. Refresh GitHub; large files should be gone from the remote commit." -ForegroundColor Green
} else {
    Write-Host "Push failed. See git output above and paste here for diagnosis." -ForegroundColor Red
    # Try to restore previous branch
    git checkout -
    exit 1
}
