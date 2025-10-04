const http = require('http')
const BASE = process.env.BASE || 'http://127.0.0.1:4000'
function req(method, path, body){
  return new Promise((resolve,reject)=>{
    const url = new URL(path, BASE)
    const data = body ? Buffer.from(JSON.stringify(body)) : null
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', 'Content-Length': data ? data.length : 0 }}, res=>{
      let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{ resolve(JSON.parse(b)) }catch{ resolve({ status: res.statusCode, text: b }) } })
    })
    r.on('error',reject); if(data) r.write(data); r.end()
  })
}
(async()=>{
  const rand = Math.floor(Math.random()*9000)+1000
  const email = `owner${rand}@example.com`
  const create = await req('POST','/api/users',{ name: 'Owner Test', email, role: 'Owner', status: 'Active', phone: `+9715999${rand}`, team: 'All Markets', password: `T3st!${rand}` })
  console.log('CREATE:', create)
  const id = create && create.data && create.data.id
  if(!id){ throw new Error('No id returned from create') }
  const list = await req('GET','/api/users')
  const row = Array.isArray(list.data) ? list.data.find(r=> String(r.id) === String(id)) : null
  console.log('FETCHED:', row)
  process.exit(0)
})().catch(e=>{ console.error('owner-role-test error:', e.message || e); process.exit(2) })
