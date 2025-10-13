param(
  [string]$Base = "http://127.0.0.1:4000",
  [string]$To = "careforce@electrixspace.com",
  [string]$Subject = "CRM app test (API)",
  [string]$Text = "Activities trigger test via /api/email/send"
)

$body = @{ to=$To; subject=$Subject; text=$Text } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/api/email/send" -ContentType 'application/json' -Body $body | ConvertTo-Json -Compress
