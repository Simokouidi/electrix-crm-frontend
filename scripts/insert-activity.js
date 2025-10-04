// Insert an activity directly into the DB. Uses server's mysql2 if available.
const fallback = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway';
let mysql;
try{ mysql = require('../server/node_modules/mysql2/promise'); }catch(e){
  try{ mysql = require('mysql2/promise') }catch(e2){ console.error('mysql2 not installed. Run npm --prefix server install'); process.exit(1) }
}

const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || fallback;

async function main(){
  const pool = await mysql.createPool({ uri: dbUrl, connectionLimit: 5 });
  try{
    // find or create a client id
    let clientId = null;
    const [clients] = await pool.query('SELECT id, client_name FROM clients ORDER BY id DESC LIMIT 1');
    if(Array.isArray(clients) && clients.length){ clientId = clients[0].id }
    if(!clientId){
      const [r] = await pool.query('INSERT INTO clients (client_name, phone, email) VALUES (?, ?, ?)', ['ScriptClient', '000', `script+${Date.now()}@example.com`]);
      clientId = r.insertId;
      console.log('Created client id', clientId);
    } else {
      console.log('Using existing client id', clientId);
    }

    // Discover activities table columns
    const [colsRows] = await pool.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities'");
    const colNames = Array.isArray(colsRows) ? colsRows.map(r=>r.COLUMN_NAME) : [];
    console.log('Detected activity columns:', colNames.join(', '));

  // Build payload using available columns in this DB schema
  const payload = {};
    if(colNames.includes('client_id')) payload['client_id'] = clientId;
    if(colNames.includes('Owner')) payload['Owner'] = process.env.ADMIN_NAME || 'Admin';
    if(colNames.includes('Title')) payload['Title'] = 'Onboarding';
    if(colNames.includes('Type')) payload['Type'] = 'Task';
    if(colNames.includes('Status')) payload['Status'] = 'Planned';
    if(colNames.includes('Client')) {
      // try to set human-readable client name if available
      const clientName = Array.isArray(clients) && clients.length ? clients[0].client_name || null : null;
      payload['Client'] = clientName || `Client ${clientId}`;
    }
    // Required Date column in this schema - set to now if present
    if(colNames.includes('Date')){
      const now = new Date();
      const sqlDatetime = now.toISOString().slice(0,19).replace('T',' ');
      payload['Date'] = sqlDatetime;
    }
    // Assignment/Owner fallbacks
    if(colNames.includes('Assignment') && !payload['Assignment']) payload['Assignment'] = process.env.ADMIN_NAME || 'Admin';

    const insertCols = Object.keys(payload);
    if(insertCols.length === 0){ throw new Error('No matching activity columns found for insert') }
    const colsSql = insertCols.map(c=>`\`${c}\``).join(', ');
    const placeholders = insertCols.map(()=>'?').join(', ');
    const params = insertCols.map(c=>payload[c]);
    const sql = `INSERT INTO activities (${colsSql}) VALUES (${placeholders})`;
    const [res] = await pool.query(sql, params);
    const insertedId = res.insertId || res.insert_id || null;
    console.log('Inserted activity id', insertedId);
    // try to fetch by activity_id or id
    let rows;
    if(colNames.includes('activity_id')){
      [rows] = await pool.query('SELECT * FROM activities WHERE activity_id = ?', [insertedId]);
    } else {
      [rows] = await pool.query('SELECT * FROM activities WHERE id = ? OR activity_id = ? LIMIT 1', [insertedId, insertedId]);
    }
    console.log('Inserted activity row:', rows && rows[0] ? rows[0] : 'not found');
  }catch(e){
    console.error('Error during DB ops', e.message || e);
    process.exitCode = 2;
  }finally{
    try{ await pool.end(); }catch(_){}
  }
}

main();
