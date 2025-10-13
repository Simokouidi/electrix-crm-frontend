let mysql;
try{ mysql = require('../server/node_modules/mysql2/promise'); }catch(e){
  try{ mysql = require('mysql2/promise') }catch(e2){ console.error('mysql2 not installed. Run npm --prefix server install'); process.exit(1) }
}
const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway';
(async()=>{
  const pool = await mysql.createPool({ uri: dbUrl, connectionLimit: 2 });
  try{
    const [rows] = await pool.query("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities'");
    console.log('activities columns:');
    console.table(rows.map(r=>({ name: r.COLUMN_NAME, dataType: r.DATA_TYPE, columnType: r.COLUMN_TYPE }))); 
  }catch(e){ console.error('err', e.message || e) }
  finally{ try{ await pool.end() }catch(_){} }
})();
