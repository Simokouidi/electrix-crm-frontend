const mysql = require('mysql2/promise')
const fs = require('fs')

async function main(){
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL
  if(!url){ console.error('No MYSQL_URL / DATABASE_URL / MYSQL_PUBLIC_URL provided'); process.exit(2) }
  const conn = await mysql.createConnection(url)
  const tables = ['users','clients','activities','user_activity']
  const out = {}
  for(const t of tables){
    try{
      const [cols] = await conn.query(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [t])
      out[t] = cols
    }catch(e){ out[t] = { error: String(e) } }
  }
  await conn.end()
  fs.writeFileSync('server/schema-introspect.json', JSON.stringify(out, null, 2))
  console.log('Wrote server/schema-introspect.json')
}

main().catch(e=>{ console.error(e); process.exit(1) })
