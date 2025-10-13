param(
  [string]$Base = 'http://127.0.0.1:4000'
)

Write-Host "Testing Users API at $Base" -ForegroundColor Cyan

function Show($label, $obj){
  Write-Host "`n=== $label ===" -ForegroundColor Yellow
  $obj | ConvertTo-Json -Depth 6
}

# 1) Create
$rand = Get-Random -Minimum 1000 -Maximum 9999
$user = @{
  name = "Test User $rand"
  email = "test$rand@example.com"
  role = "Executive"
  team = "Dubai Sales"
  phone = "+9715000$rand"
  status = "Active"
  password = "P@ssw0rd!$rand"
  lastLogin = (Get-Date).ToString('s')
} | ConvertTo-Json

try{
  $create = Invoke-RestMethod -Uri "$Base/api/users" -Method Post -Body $user -ContentType 'application/json' -TimeoutSec 20
  Show 'CREATE' $create
} catch {
  Write-Error "Create failed: $_"
  exit 1
}

$id = $create.data.id

# 2) List
try{
  $list = Invoke-RestMethod -Uri "$Base/api/users" -TimeoutSec 20
  Show 'LIST' $list
} catch {
  Write-Error "List failed: $_"
  exit 1
}

# 3) Update
$updateBody = @{ role='BDM'; team='Saudi Arabia'; status='Suspended'; phone='+9715111'+$rand; lastLogin=(Get-Date).AddMinutes(-5).ToString('s') } | ConvertTo-Json
try{
  $update = Invoke-RestMethod -Uri "$Base/api/users/$id" -Method Put -Body $updateBody -ContentType 'application/json' -TimeoutSec 20
  Show 'UPDATE' $update
} catch {
  Write-Error "Update failed: $_"
  exit 1
}

Write-Host "Users API test completed." -ForegroundColor Green
