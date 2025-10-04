(async ()=>{
  const mysql = require('mysql2/promise')
  const url = process.env.DB_URL || 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
  const conn = await mysql.createConnection(url)
  try {
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'")
    if(cols && cols.length){
      console.log('password_plain already exists')
    } else {
      await conn.query("ALTER TABLE `users` ADD COLUMN `password_plain` VARCHAR(255) NULL AFTER `password`")
      console.log('password_plain column added')
    }
  } catch (e){
    console.error('Failed to alter table:', e.message || e)
    process.exit(2)
  } finally {
    await conn.end()
  }
})()
