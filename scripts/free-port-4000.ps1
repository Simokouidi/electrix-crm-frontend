# Frees port 4000 on Windows by finding and killing the owning process
param(
  [int]$Port = 4000
)

Write-Host "Checking port $Port..."
try {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
} catch {
  $connections = @()
}
if ($connections.Count -eq 0) {
  Write-Host "Port $Port is not in LISTEN state. Nothing to free."
  exit 0
}

$OwnerPid = ($connections | Select-Object -First 1).OwningProcess
if (-not $OwnerPid) {
  Write-Host "Could not determine owning process for port $Port"
  exit 1
}

try {
  $proc = Get-Process -Id $OwnerPid -ErrorAction Stop
  Write-Host "Killing PID $OwnerPid ($($proc.ProcessName)) to free port $Port..."
  Stop-Process -Id $OwnerPid -Force
  Start-Sleep -Milliseconds 400
  Write-Host "Port $Port freed."
  exit 0
} catch {
  Write-Host ("Failed to kill PID {0}: {1}" -f $OwnerPid, $_.Exception.Message)
  exit 1
}
