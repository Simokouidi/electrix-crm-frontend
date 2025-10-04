const { execSync } = require('child_process')

function getPidsUsingPort(port){
  try{
    const out = execSync('netstat -ano', { encoding: 'utf8' })
    const lines = out.split(/\r?\n/)
    const pids = new Set()
    for(const line of lines){
      const parts = line.trim().split(/\s+/)
      if(parts.length >= 5){
        const local = parts[1]
        const state = parts[3]
        const pid = parts[4]
        if(local && local.endsWith(':'+port) && (state === 'LISTENING' || state === 'ESTABLISHED')){
          pids.add(pid)
        }
      }
    }
    return Array.from(pids)
  }catch(e){
    console.error('Failed to run netstat', e.message || e)
    return []
  }
}

function killPid(pid){
  try{
    console.log('Killing PID', pid)
    execSync(`taskkill /PID ${pid} /F`) 
  }catch(e){
    console.warn('Could not kill PID', pid, e.message || e)
  }
}

const port = process.env.PORT || '4000'
const pids = getPidsUsingPort(port)
if(pids.length === 0){
  console.log('No process found on port', port)
  process.exit(0)
}
for(const pid of pids) killPid(pid)
console.log('Done')
