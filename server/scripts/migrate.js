const { createPool } = require('mysql2/promise')

async function main(){
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(!url){
    console.error('Please set MYSQL_URL or DATABASE_URL')
    process.exit(2)
  }

  const pool = createPool({ uri: url, connectionLimit: 5 })
  try{
    console.log('Creating clients table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        clientName VARCHAR(255) NOT NULL,
        legalName VARCHAR(255),
        industry VARCHAR(255),
        country VARCHAR(100),
        ownerId VARCHAR(50),
        status VARCHAR(50),
        pipelineStage VARCHAR(100),
        dealValue DECIMAL(15,2),
        probability INT,
        contactName VARCHAR(255),
        contactEmail VARCHAR(255),
        preferredChannel VARCHAR(50),
        lastActivityDate DATETIME,
        nextFollowUpDate DATETIME NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    console.log('Creating activities table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(50) PRIMARY KEY,
        parentId VARCHAR(50),
        version INT DEFAULT 1,
        type VARCHAR(50),
        title VARCHAR(255),
        notes TEXT,
        clientId VARCHAR(50),
        ownerId VARCHAR(50),
        datetime DATETIME,
        status VARCHAR(50),
        assignment VARCHAR(255),
        cut_off_date DATETIME NULL,
        postpones_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    console.log('Creating users table (if not exists)...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) DEFAULT 'User',
        password VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    console.log('Migration complete')
  }catch(err){
    console.error('Migration failed', err?.message || err)
    process.exit(3)
  }finally{
    await pool.end()
  }
}

main().catch(e=>{ console.error(e); process.exit(1) })
