# Export local whatsapp-web.js LocalAuth session to a JSON payload
# Usage:
#   powershell -File scripts\export-local-whatsapp-session.ps1 -AuthDir .\.local-auth -OutFile session.json
param(
  [Parameter(Mandatory=$true)][string]$AuthDir,
  [Parameter(Mandatory=$true)][string]$OutFile
)

if(!(Test-Path $AuthDir)){
  Write-Error "AuthDir not found: $AuthDir"; exit 1
}

$files = Get-ChildItem -Path $AuthDir -Recurse -File
$payload = @{ files = @() }
foreach($f in $files){
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $b64 = [System.Convert]::ToBase64String($bytes)
  # Make path relative to the auth dir root
  $rel = Resolve-Path -Path $f.FullName
  $rel = $rel.Path.Substring((Resolve-Path -Path $AuthDir).Path.Length).TrimStart('\','/')
  $payload.files += @{ path = $rel; dataBase64 = $b64 }
}

# Save JSON
$payload | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutFile -Encoding UTF8
Write-Host "Session exported to $OutFile with $($files.Count) files."