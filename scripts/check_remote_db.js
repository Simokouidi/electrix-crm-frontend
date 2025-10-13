(async ()=>{
  try{
    const mysql = require('mysql2/promise')
    const url = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
    const conn = await mysql.createConnection(url)
    console.log('Connected to remote DB')
    const tables = ['users','clients','activities','user_activity']
    for(const t of tables){
      console.log('\n=== TABLE:', t, '===')
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [t]
      )
      if(!cols || cols.length === 0){
        console.log('Table not found or no columns')
        continue
      }
      console.log('COLUMNS:')
      cols.forEach(c=> console.log(' -', c.COLUMN_NAME, c.DATA_TYPE, c.COLUMN_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT))
      // try select sample rows
      try{
        // check if id column exists
        const hasId = cols.some(c=>c.COLUMN_NAME.toLowerCase() === 'id')
        const q = hasId ? `SELECT * FROM \`${t}\` ORDER BY id DESC LIMIT 5` : `SELECT * FROM \`${t}\` LIMIT 5`
        const [rows] = await conn.query(q)
        console.log('SAMPLE ROWS:', JSON.stringify(rows, null, 2))
      }catch(e){
        console.log('Could not SELECT from table:', e.message)
      }
      // count rows
      try{
        const [[{cnt}]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``)
        console.log('ROW COUNT:', cnt)
      }catch(e){
        console.log('Count failed:', e.message)
      }
    }
    await conn.end()
  }catch(e){
    console.error('ERROR CONNECTING OR QUERYING:', e && e.message ? e.message : e)
    process.exit(2)
  }
})()
