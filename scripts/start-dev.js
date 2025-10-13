const { spawn, execSync } = require('child_process')
const path = require('path')

function run(cmd, args, opts = {}){
  const cwd = opts.cwd || process.cwd()
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd })
  p.on('error', err => console.error(`${cmd} failed:`, err && err.message ? err.message : err))
  p.on('exit', (code, signal) => {
    if(code !== null){
      console.log(`${cmd} exited with code ${code}`)
    } else if(signal){
      console.log(`${cmd} killed with signal ${signal}`)
    }
  })
  return p
}

// Start server first so API is up. Try to stop any lingering server on port 4000.
try{
  const stopScript = path.resolve(__dirname, '..', 'server', 'scripts', 'stopServer.js')
  console.log('Ensuring no existing server is running...')
  execSync(`node "${stopScript}"`, { stdio: 'inherit' })
}catch(e){
  // ignore errors from stop
}

// Spawn server in detached mode so tools like ts-node-dev that restart the server
// don't send signals to this parent process (which would stop the dev runner).
const serverOpts = { cwd: path.resolve(__dirname, '..'), detached: true }
const server = run('npm', ['run', 'dev:server'], serverOpts)
try{ if(server && typeof server.unref === 'function') server.unref() }catch(e){}
console.log('Server PID:', server && server.pid)

const frontend = run('npm', ['run', 'dev:frontend'], { cwd: path.resolve(__dirname, '..') })
console.log('Frontend PID:', frontend && frontend.pid)

function cleanup(){
  console.log('Stopping dev processes...')
  try{ if(server && !server.killed) server.kill() }catch(e){}
  try{ if(frontend && !frontend.killed) frontend.kill() }catch(e){}
}

process.on('SIGINT', () => { cleanup(); process.exit(0) })
process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('exit', cleanup)

// Keep the parent process alive so child processes can continue running until user stops them.
process.stdin.resume()
