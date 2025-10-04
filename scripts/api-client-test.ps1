$base='http://127.0.0.1:4000'
$body = @{
  clientName='Test Client From API'
  ownerId='t-simo'
  status='Planned'
  lastActivityDate=(Get-Date).ToString('o')
} | ConvertTo-Json
try {
  $create = Invoke-RestMethod -Uri "$base/api/clients" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 10
  Write-Output "CREATE:"
  $create | ConvertTo-Json -Depth 5
} catch {
  Write-Error "Create failed: $_"
  exit 1
}
$id = $create.data.id
Write-Output "ID:$id"
$updateBody = @{ clientName='Test Client From API - Edited'; dealValue=12345 } | ConvertTo-Json
try {
  $update = Invoke-RestMethod -Uri "$base/api/clients/$id" -Method Put -Body $updateBody -ContentType 'application/json' -TimeoutSec 10
  Write-Output "UPDATE:"
  $update | ConvertTo-Json -Depth 5
} catch {
  Write-Error "Update failed: $_"
  exit 1
}
try {
  $del = Invoke-RestMethod -Uri "$base/api/clients/$id" -Method Delete -TimeoutSec 10
  Write-Output "DELETE:"
  $del | ConvertTo-Json -Depth 5
} catch {
  Write-Error "Delete failed: $_"
  exit 1
}
