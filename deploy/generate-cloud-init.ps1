Param(
  [string]$repoUrl,
  [string]$botKey
)
if(-not $repoUrl -or -not $botKey){
  Write-Host "Usage: .\generate-cloud-init.ps1 -repoUrl <git-url> -botKey <BOT_API_KEY>" -ForegroundColor Yellow
  exit 1
}
$content = Get-Content -Raw .\cloud-init.yml
$content = $content -replace '<REPO_URL>', $repoUrl
$content = $content -replace '<BOT_API_KEY>', $botKey
$out = "cloud-init-generated.yml"
Set-Content -Path $out -Value $content
Write-Host "Wrote $out — upload this as user-data when creating your VM."
