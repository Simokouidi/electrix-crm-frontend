# Sends the exact test template message to the WhatsApp Cloud API (Meta)
# Usage examples (PowerShell):
#   $env:WHATSAPP_TOKEN="<token>"; $env:WHATSAPP_PHONE_ID="<phoneId>"; .\send_whatsapp_test.ps1 -to "+85262392890"
#   .\send_whatsapp_test.ps1 -token "<token>" -phoneId "<phoneId>" -to "+85262392890"
param(
  [string]$token = $env:WHATSAPP_TOKEN,
  [string]$phoneId = $env:WHATSAPP_PHONE_ID,
  [string]$to = "+85262392890"
)

if(-not $token -or -not $phoneId){
  Write-Host "Error: token and phoneId are required. Provide via params or environment variables WHATSAPP_TOKEN and WHATSAPP_PHONE_ID." -ForegroundColor Red
  exit 1
}

# The exact template requested by the user
$testMessage = "Hello World`nWelcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.`nWhatsApp Business Platform sample message"

# Remove plus sign for the API 'to' field
$toClean = $to -replace '^\+', ''

# Endpoint
$endpoint = "https://graph.facebook.com/v22.0/$phoneId/messages"

# Send a template handshake then the text body
try{
  Write-Host "Sending template handshake to $toClean via phoneId $phoneId..." -ForegroundColor Cyan
  $templateBody = @{ messaging_product = 'whatsapp'; to = $toClean; type = 'template'; template = @{ name = 'hello_world'; language = @{ code = 'en_US' } } } | ConvertTo-Json -Depth 5
  $r1 = Invoke-RestMethod -Uri $endpoint -Method Post -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } -Body $templateBody -ErrorAction Stop
  $r1 | ConvertTo-Json -Depth 5 | Write-Host
  if($r1.messages -and $r1.messages[0].id){ Write-Host "Template message id: $($r1.messages[0].id)" -ForegroundColor Yellow }

  Write-Host "Sending text body..." -ForegroundColor Cyan
  $body = @{ messaging_product = 'whatsapp'; to = $toClean; type = 'text'; text = @{ body = $testMessage } } | ConvertTo-Json -Depth 5
  $r2 = Invoke-RestMethod -Uri $endpoint -Method Post -Headers @{ Authorization = "Bearer $token"; 'Content-Type'='application/json' } -Body $body -ErrorAction Stop
  $r2 | ConvertTo-Json -Depth 5 | Write-Host
  if($r2.messages -and $r2.messages[0].id){ Write-Host "Text message id: $($r2.messages[0].id)" -ForegroundColor Green }

}catch{
  Write-Host "Send failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "Done." -ForegroundColor Green
