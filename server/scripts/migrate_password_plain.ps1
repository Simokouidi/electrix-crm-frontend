param(
  [string]$DbUrl = $env:DB_URL
)
if (-not $DbUrl) { $DbUrl = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway' }
Write-Host "Using DB: $DbUrl"
node server\scripts\add_password_plain_column.js