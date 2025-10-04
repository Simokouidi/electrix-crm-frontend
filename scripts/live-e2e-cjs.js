// Load mysql2 from server node_modules if available
let mysql;
try{
  mysql = require('../server/node_modules/mysql2/promise');
}catch(e){
  try{ mysql = require('mysql2/promise') }catch(e2){ throw new Error('mysql2 not found; please run npm install in server folder') }
}
const fetch = global.fetch || (typeof require === 'function' ? require('node-fetch') : null);

const SERVER = 'http://127.0.0.1:4000';
const FALLBACK_DB = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function waitServerReady(timeoutMs=20000){
  const start = Date.now();
  while(Date.now() - start < timeoutMs){
    try{
      const res = await fetch(`${SERVER}/health`, { method: 'GET' });
      if(res.ok) return true
    }catch(e){ /* ignore */ }
    await sleep(500);
  }
  return false;
}

async function postClient(){
  const email = `live+${Date.now()}@example.com`;
  const payload = { firstName: 'LIVE', lastName: 'Tester', company: 'LiveCo', phone: '000', email };
  const res = await fetch(`${SERVER}/api/clients`, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(payload) });
  if(!res.ok){
    const txt = await res.text().catch(()=>null);
    throw new Error(`POST /api/clients failed ${res.status} ${txt}`)
  }
  const body = await res.json();
  return { client: body.data, email };
}

function dbUrl(){
  return process.env.DATABASE_URL || process.env.MYSQL_URL || FALLBACK_DB
}

async function checkActivityInDb(clientId){
  const url = dbUrl();
  const conn = await mysql.createPool({ uri: url, connectionLimit: 5 });
  try{
    const [rows] = await conn.query('SELECT * FROM activities WHERE client_id = ? ORDER BY id DESC LIMIT 1', [clientId]);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }finally{
    await conn.end();
  }
}

(async function(){
  console.log('Waiting for server health...');
  const ok = await waitServerReady(20000);
  if(!ok){
    console.error('Server not ready after timeout'); process.exit(2)
  }
  console.log('Server is healthy; posting client...');
  let cli;
  try{
    const res = await postClient();
    cli = res.client;
    console.log('Client created id=', cli.id);
  }catch(e){
    console.error('Failed to create client:', e.message); process.exit(3)
  }

  console.log('Checking DB for activity for client id', cli.id);
  const start = Date.now();
  let found = null;
  while(Date.now() - start < 30000){
    try{
      const act = await checkActivityInDb(cli.id);
      if(act){ found = act; break }
    }catch(e){ console.warn('DB check error', e.message) }
    await sleep(1000);
  }
  if(found){
    console.log('Activity found in DB:', found);
    process.exit(0)
  } else {
    console.error('Activity not found in DB within timeout'); process.exit(4)
  }
})();
