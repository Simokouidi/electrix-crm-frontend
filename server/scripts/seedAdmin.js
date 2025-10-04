const { createPool } = require('mysql2/promise')
const bcrypt = require('bcryptjs')

async function main(){
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(!url){
    console.error('Please set MYSQL_URL or DATABASE_URL environment variable')
    process.exit(2)
  }
    const adminName = process.env.ADMIN_NAME || 'Admin'
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin'
  const adminId = 'u-admin'

  const pool = createPool({ uri: url, connectionLimit: 10 })
  try{
    console.log('Ensuring users table exists...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(40) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'User',
        password VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    // Ensure email has a UNIQUE index so we can upsert by email
    try{
      const [idxRows] = await pool.query("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'")
      const hasEmailIndex = Array.isArray(idxRows) && idxRows.length > 0
      if(!hasEmailIndex){
        console.log('Adding UNIQUE index on users.email')
        await pool.query('ALTER TABLE users ADD UNIQUE INDEX ux_users_email (email)')
      }
    }catch(idxErr){
      console.warn('Failed to ensure email index:', idxErr.message || idxErr)
    }

    // Ensure password column exists (in case table was pre-existing without it)
    try{
      const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'password'")
      const hasPassword = Array.isArray(cols) && cols.length > 0
      if(!hasPassword){
        console.log('Adding password column to users table')
        await pool.query("ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL")
      }
    }catch(colErr){
      console.warn('Failed to ensure password column:', colErr.message || colErr)
    }

    const hashed = bcrypt.hashSync(adminPassword, 10)
    console.log('Upserting admin user...', adminName)

    // If a user with the admin email exists, update it; otherwise insert.
    const adminEmail = adminName + '@local'
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail])
    if(Array.isArray(rows) && rows.length > 0){
      console.log('Admin user exists, updating...')
      await pool.query('UPDATE users SET name = ?, role = ?, password = ? WHERE email = ?', [adminName, 'Admin', hashed, adminEmail])
    }else{
      // Determine id column type; if it's integer, don't provide the id value
      let idIsInt = false
      try{
        const [idCol] = await pool.query("SHOW COLUMNS FROM users LIKE 'id'")
        if(Array.isArray(idCol) && idCol.length > 0){
          const type = idCol[0].Type || idCol[0].type || ''
          if(/int/i.test(type) || /bigint/i.test(type)) idIsInt = true
        }
      }catch(e){/* ignore */}

      if(idIsInt){
        console.log('Inserting new admin user without id (numeric id column detected)')
        await pool.query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', [adminName, adminEmail, 'Admin', hashed])
      }else{
        console.log('Inserting new admin user with deterministic id')
        await pool.query('INSERT INTO users (id, name, email, role, password) VALUES (?, ?, ?, ?, ?)', [adminId, adminName, adminEmail, 'Admin', hashed])
      }
    }

    console.log('Done. Admin user ensured with id', adminId)
  }catch(err){
    console.error('Error seeding admin:', err.message || err)
    process.exit(3)
  }finally{
    await pool.end()
  }
}

main()
.catch(err => { console.error(err); process.exit(1) })
