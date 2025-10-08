// Kill any process listening on port 4000 (Windows PowerShell)
const { execSync } = require('child_process')

try {
  // Find PID on port 4000
  const cmd = 'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object -ExpandProperty OwningProcess"'
  const pid = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  if(pid){
    // Kill the process
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' })
    console.log(`Killed process ${pid} on port 4000`)
  } else {
    console.log('No process found on port 4000')
  }
} catch (e) {
  console.log('No listener found on port 4000 or insufficient privileges.')
}
