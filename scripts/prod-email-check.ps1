# Quick check against production backend email endpoints
# Usage: .\scripts\prod-email-check.ps1 -BaseUrl "https://your-backend.example.com" -Token "<EMAIL_TOKEN>" -To "me@example.com"
param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$false)][string]$Token,
  [Parameter(Mandatory=$false)][string]$To
)

Write-Host "Checking /api/email/health at $BaseUrl" -ForegroundColor Cyan
try {
  $h = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/email/health" -ErrorAction Stop
  Write-Host (ConvertTo-Json $h -Compress)
} catch {
  Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

if($To){
  Write-Host "Sending /api/email/test to $To" -ForegroundColor Cyan
  $headers = @{}
  if($Token){ $headers['X-CRM-Token'] = $Token }
  try {
    $body = @{ to=$To } | ConvertTo-Json -Compress
    $t = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/email/test" -ContentType 'application/json' -Headers $headers -Body $body -ErrorAction Stop
    Write-Host (ConvertTo-Json $t -Compress)
  } catch {
    Write-Host "Test send failed: $($_.Exception.Response.StatusCode.value__): $($_.Exception.Message)" -ForegroundColor Yellow
    try{ $resp = $_.Exception.Response.GetResponseStream(); if($resp){ $sr = New-Object System.IO.StreamReader($resp); Write-Host ($sr.ReadToEnd()) } } catch {}
  }
}
