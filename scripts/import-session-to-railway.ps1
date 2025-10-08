# Upload a local whatsapp-web.js LocalAuth session to Railway bot service
# Prereqs:
# - Have session.json created by export-local-whatsapp-session.ps1
# - Set $BotUrl to your Railway bot public URL (e.g. https://your-bot.up.railway.app)
# - Set $BotApiKey to the same BOT_API_KEY configured on Railway
param(
  [Parameter(Mandatory=$true)][string]$SessionFile,
  [Parameter(Mandatory=$true)][string]$BotUrl,
  [Parameter(Mandatory=$true)][string]$BotApiKey,
  [switch]$Force
)

if(!(Test-Path $SessionFile)){
  Write-Error "Session file not found: $SessionFile"; exit 1
}

$body = Get-Content -Raw -Path $SessionFile | ConvertFrom-Json
if($Force){ $body | Add-Member -NotePropertyName force -NotePropertyValue $true -Force }

$headers = @{ Authorization = "Bearer $BotApiKey"; 'Content-Type' = 'application/json' }

try{
  $json = $body | ConvertTo-Json -Depth 6
  $res = Invoke-RestMethod -Method Post -Uri (Join-Path $BotUrl '/import-session') -Headers $headers -Body $json
  $res | ConvertTo-Json -Depth 5
}catch{
  Write-Error $_.Exception.Message
  if($_.Exception.Response){
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $respText = $reader.ReadToEnd()
    Write-Host $respText
  }
  exit 1
}
