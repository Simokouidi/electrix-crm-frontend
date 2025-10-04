(async ()=>{
  try{
    const mysql = require('mysql2/promise')
    const url = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
    const conn = await mysql.createConnection(url)
    console.log('Connected')
    // Mapping from canonical fields -> live DB columns (based on previous introspect)
    const client = {
      client_name: 'ELECTRIX_TEST_'+Date.now(),
      contact_email: 'test-write@electrix.local',
      contact_name: 'Auto Tester',
      country: 'TestLand',
      deal_value: 12345.67,
      industry: 'Testing',
      notes: 'Inserted by remote_write_test',
      owner: 'Admin',
      owner_email: 'admin@local',
      preferred_channel: 'Email',
      stage: 'Discovery',
      status: 'Planned'
    }
    const cols = Object.keys(client)
    const vals = cols.map(c=>client[c])
    const placeholders = cols.map(_=>'?').join(', ')
    const sql = `INSERT INTO clients (${cols.map(c=>'\`'+c+'\`').join(',')}) VALUES (${placeholders})`
    const [res] = await conn.query(sql, vals)
    console.log('Inserted id', res.insertId)
    const [rows] = await conn.query('SELECT * FROM clients WHERE id = ?', [res.insertId])
    console.log('Row:', JSON.stringify(rows[0], null, 2))
    await conn.end()
    process.exit(0)
  }catch(e){
    console.error('FAIL:', e && e.message ? e.message : e)
    process.exit(2)
  }
})()
