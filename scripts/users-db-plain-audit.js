(async ()=>{
  const mysql = require('mysql2/promise')
  const url = process.env.DB_URL || 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
  const conn = await mysql.createConnection(url)
  try{
    const [rows] = await conn.query("SELECT id, email, name, password, password_plain FROM users ORDER BY id DESC LIMIT 10")
    console.log(JSON.stringify(rows, null, 2))
  }catch(e){
    console.error('Audit failed:', e.message || e)
    process.exit(2)
  }finally{
    await conn.end()
  }
})()
