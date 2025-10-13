const http = require('http')

const BASE = process.env.BASE || 'http://127.0.0.1:4000'

function request(method, path, body){
  return new Promise((resolve, reject)=>{
    const url = new URL(path, BASE)
    const data = body ? Buffer.from(JSON.stringify(body)) : null
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', 'Content-Length': data ? data.length : 0 }}, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', ()=>{
        try{ resolve(JSON.parse(buf)) }catch{ resolve({ status: res.statusCode, body: buf }) }
      })
    })
    req.on('error', reject)
    if(data) req.write(data)
    req.end()
  })
}

(async()=>{
  const rand = Math.floor(Math.random()*9000)+1000
  const createBody = {
    name: `Terminal Test ${rand}`,
    email: `terminal${rand}@example.com`,
    role: 'Executive',
    team: 'Dubai Sales',
    phone: `+9715000${rand}`,
    status: 'Active',
    password: `P@ssw0rd!${rand}`,
    lastLogin: new Date().toISOString()
  }
  console.log('CREATE ->', createBody)
  const created = await request('POST', '/api/users', createBody)
  console.log('CREATE RESULT <-', JSON.stringify(created, null, 2))
  const id = created && created.data && created.data.id
  if(!id){ throw new Error('No id returned from create') }

  const list = await request('GET', '/api/users')
  console.log('LIST COUNT <-', Array.isArray(list.data) ? list.data.length : 'N/A')

  const updateBody = { role: 'BDM', team: 'Saudi Arabia', status: 'Suspended', phone: `+9715111${rand}` }
  console.log('UPDATE ->', id, updateBody)
  const updated = await request('PUT', `/api/users/${id}`, updateBody)
  console.log('UPDATE RESULT <-', JSON.stringify(updated, null, 2))

  process.exit(0)
})().catch(e=>{ console.error('users-api-test error:', e.message || e); process.exit(2) })
