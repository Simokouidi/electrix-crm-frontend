const mysql = require('mysql2/promise')

async function getDbUrl(){
  const env = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(env) return env
  // Fallback mirrors server/src/index.ts local dev convenience
  return 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
}

async function main(){
  const url = await getDbUrl()
  const conn = await mysql.createConnection(url)
  const [rows] = await conn.query('DESCRIBE users')
  console.log(JSON.stringify(rows, null, 2))
  await conn.end()
}

main().catch(e=>{ console.error('describe-users error:', e.message || e); process.exit(1) })
