param(
  [string]$DatabaseUrl
)

Write-Host "Building frontend..."
npm run build

Write-Host "Starting backend (read-only if no DB)..."
# Use npm.cmd on Windows so Start-Process resolves correctly
Start-Process -NoNewWindow -FilePath npm.cmd -ArgumentList 'run','dev:server'
Start-Sleep -Seconds 2

# Probe backend DB diagnostic endpoint
try {
  $res = Invoke-WebRequest -Uri http://127.0.0.1:4000/api/db/check -UseBasicParsing -TimeoutSec 3
  Write-Host "DB check response:`n" $res.Content
} catch {
  Write-Host "DB diagnostic endpoint not reachable or returned error. Server may be running in read-only/no-db mode."
}
Write-Host "Starting static server on :5173"
Start-Process -NoNewWindow -FilePath node -ArgumentList 'scripts/static-server.js'
Start-Sleep -Seconds 1
Write-Host "Installing Playwright browsers..."
npx playwright install --with-deps

Write-Host "Running E2E test..."
$env:APP_URL='http://127.0.0.1:5173'
node scripts/automated-tests/browser-notify.spec.js

Write-Host "E2E completed."

Write-Host "(You may need to stop background processes manually.)"
