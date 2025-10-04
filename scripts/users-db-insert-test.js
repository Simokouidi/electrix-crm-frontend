const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')

async function getDbUrl(){
  return process.env.MYSQL_URL || process.env.DATABASE_URL || 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
}

async function main(){
  const url = await getDbUrl()
  const conn = await mysql.createConnection(url)
  const rand = Math.floor(Math.random()*9000)+1000
  const email = `dbtest${rand}@example.com`
  const name = `DB Test ${rand}`
  const phone = `+9715000${rand}`
  const role = 'Executive' // valid enum
  const status = 'Active'  // valid enum
  const team = 'Dubai Sales'
  const lastLogin = new Date()
  const password = bcrypt.hashSync(`P@ssw0rd!${rand}`, 10)

  // Insert honoring capitalized Phone column
  const [res] = await conn.query(
    `INSERT INTO users (name, email, role, team, status, last_login, password, \`Phone\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, role, team, status, lastLogin, password, phone]
  )
  console.log('INSERT OK:', res && res.insertId)

  const [rows] = await conn.query('SELECT id, name, email, role, team, status, last_login, `Phone` FROM users WHERE email = ?', [email])
  console.log('SELECT ->', JSON.stringify(rows, null, 2))
  await conn.end()
}

main().catch(e=>{ console.error('users-db-insert-test error:', e.message || e); process.exit(1) })
