const { createPool } = require('mysql2/promise')

async function main(){
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(!url){
    console.error('Please set MYSQL_URL or DATABASE_URL environment variable')
    process.exit(2)
  }
  const pool = createPool({ uri: url, connectionLimit: 10 })
  try{
    const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE email = ? LIMIT 1', ['admin@local'])
    console.log(JSON.stringify(rows, null, 2))
  }catch(err){
    console.error('Error querying users:', err.message || err)
    process.exit(3)
  }finally{
    await pool.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
