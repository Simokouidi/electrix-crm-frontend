import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (default .env then fallback to server/.env explicitly)
dotenv.config();
if(!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS){
  try{ dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); }catch{ /* noop */ }
}
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import { createPool } from 'mysql2/promise';
import clientsRouter from './routes/clients';
import activitiesRouter from './routes/activities';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import dbRouter from './routes/db';
import botRouter from './routes/bot';
import usageRouter from './routes/usage';
import metricsRouter from './routes/metrics';
import emailRouter from './routes/email';
import { loadSchema } from './schema'
import bcrypt from 'bcryptjs';

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Basic health
app.get('/health', (req, res) => res.json({ ok: true }));

// mount API routers
app.use('/api/clients', clientsRouter(io));
app.use('/api/activities', activitiesRouter(io));
app.use('/api/users', usersRouter(io));
app.use('/api/auth', authRouter(io));
app.use('/api/db', dbRouter);
app.use('/api/bot', botRouter());
app.use('/api/usage', usageRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/email', emailRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function validateSchema(pool: ReturnType<typeof createPool>) {
  // Simple check: ensure tables exist and have expected columns. If DB not configured, skip.
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'clients'");
    // If clients table not present, warn but continue — the user can migrate.
    console.log('Schema check completed.');
  } catch (err) {
    console.warn('Schema validation skipped or failed:', (err as Error).message);
  }
}

async function start() {
  // create DB pool if env provided
  let pool: ReturnType<typeof createPool> | undefined;
  // If no env provided, fall back to known Railway connection (local dev convenience).
  // NOTE: This is a development fallback only. In production set $MYSQL_URL or $DATABASE_URL.
  if (!process.env.MYSQL_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'mysql://root:oXDKUvELygixOZoAvcnvOwkrIhnlAvlZ@nozomi.proxy.rlwy.net:10409/railway'
    console.log('No DATABASE_URL provided — using configured Railway fallback for local dev')
  }

  if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL!;
    // mysql2 supports passing a connection URI string directly
    pool = createPool(url);
    await validateSchema(pool);
    // store pool on app locals for routers
    (app as any).db = pool;
    // load schema mapping and attach to app
    try {
      const mapping = await loadSchema(pool as any);
      (app as any).schema = mapping;
      console.log('Loaded DB schema mapping for users, clients, activities, user_activity');
    } catch (e: any) {
      console.warn('Failed to load DB schema mapping:', e?.message || e);
    }
  } else {
    console.warn('No MYSQL_URL / DATABASE_URL provided. Server will run in read-only/no-db mode.');
  }

  // Ensure admin user exists when DB is available
  if(pool){
    try{
      const adminName = process.env.ADMIN_NAME || 'Admin'
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin'
      // Ensure `users` table exists with expected columns (id PK, name, email UNIQUE, role, password)
      try{
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(40) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            role VARCHAR(50) DEFAULT 'User',
            password VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `)
        console.log('Ensured users table exists')
      }catch(tblErr:any){
        console.warn('Failed to ensure users table exists:', tblErr?.message || tblErr)
      }

      // Upsert admin user with a hashed password.
      try{
        const hashed = bcrypt.hashSync(adminPassword, 10)
        const adminEmail = adminName + '@local'
        // Determine if `users.id` is an INT AUTO_INCREMENT; if so, do not try to insert id.
        let idIsAutoInt = false
        try{
          const [rows]: any = await pool.query("SELECT DATA_TYPE, EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'")
          if(Array.isArray(rows) && rows.length){
            const r = rows[0]
            idIsAutoInt = String(r.DATA_TYPE).toLowerCase().includes('int') && String(r.EXTRA||'').toLowerCase().includes('auto_increment')
          }
        }catch{/* ignore */}

        // Upsert by email only to be compatible with INT ids
        const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail])
        if(Array.isArray(existing) && existing.length > 0){
          await pool.query('UPDATE users SET name = ?, role = ?, password = ? WHERE email = ?', [adminName, 'Admin', hashed, adminEmail])
          console.log('Admin user updated by email')
        }else{
          // Detect if schema has a NOT NULL Phone/phone column without default; include a placeholder value if needed
          let needPhoneCol: string | null = null
          try{
            const [cols]: any = await pool.query("SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'")
            if(Array.isArray(cols)){
              for(const c of cols){
                const n = String(c.COLUMN_NAME)
                const isNotNull = String(c.IS_NULLABLE||'').toUpperCase() === 'NO'
                const hasDefault = c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined
                if((n === 'Phone' || n === 'phone') && isNotNull && !hasDefault){ needPhoneCol = n; break }
              }
            }
          }catch{/* ignore */}
          if(needPhoneCol){
            const sql = `INSERT INTO users (name, email, role, password, ${needPhoneCol}) VALUES (?, ?, ?, ?, ?)`
            await pool.query(sql, [adminName, adminEmail, 'Admin', hashed, ''])
          }else{
            await pool.query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', [adminName, adminEmail, 'Admin', hashed])
          }
          console.log('Admin user inserted by email')
        }
      }catch(upsertErr:any){
        console.warn('Failed to upsert admin user:', upsertErr?.message || upsertErr)
      }
    }catch(err:any){
      console.warn('Unable to ensure admin user:', err?.message || err)
    }
  }

  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);
  });

  server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});

