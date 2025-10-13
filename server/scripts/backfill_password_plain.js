(async ()=>{
  const mysql = require('mysql2/promise')
  const bcrypt = require('bcryptjs')
  const url = process.env.DB_URL || 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
  const conn = await mysql.createConnection(url)
  try{
    // Ensure column exists
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'")
    if(!cols || !cols.length){
      await conn.query("ALTER TABLE `users` ADD COLUMN `password_plain` VARCHAR(255) NULL AFTER `password`")
      console.log('Added password_plain column')
    }
    // Find rows where password is non-empty and not bcrypt
    const [rows] = await conn.query("SELECT id, password FROM users WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2a$%' ORDER BY id DESC")
    console.log('Rows with cleartext password:', rows.length)
    for(const r of rows){
      const plain = String(r.password)
      const hashed = bcrypt.hashSync(plain, 10)
      await conn.query('UPDATE users SET password_plain = ?, password = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [plain, hashed, r.id])
      console.log('Updated id', r.id)
    }
    // Report summary
    const [[{cntAll}]] = await conn.query("SELECT COUNT(*) AS cntAll FROM users")
    const [[{cntPlain}]] = await conn.query("SELECT COUNT(*) AS cntPlain FROM users WHERE password_plain IS NOT NULL AND password_plain <> ''")
    console.log('Summary: total users', cntAll, 'with password_plain', cntPlain)
  }catch(e){
    console.error('Backfill failed:', e.message || e)
    process.exit(2)
  }finally{
    await conn.end()
  }
})()
