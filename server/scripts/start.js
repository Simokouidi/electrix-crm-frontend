// Compose DATABASE_URL from Railway MYSQL* env vars if needed, then start server
(function ensureDatabaseUrl(){
  try{
    if(!process.env.MYSQL_URL && !process.env.DATABASE_URL){
      const { MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE } = process.env;
      if(MYSQLHOST && MYSQLPORT && MYSQLUSER && MYSQLPASSWORD && MYSQLDATABASE){
        const enc = encodeURIComponent;
        process.env.DATABASE_URL = `mysql://${enc(MYSQLUSER)}:${enc(MYSQLPASSWORD)}@${MYSQLHOST}:${MYSQLPORT}/${MYSQLDATABASE}`;
        console.log('[startup] Constructed DATABASE_URL from Railway MYSQL* env vars');
      } else {
        console.log('[startup] No DB URL and incomplete MYSQL* vars; server will run without DB');
      }
    }
  }catch(e){ /* ignore */ }
})();

require('../dist/index.js');
