import { Router } from 'express';
import { Server as IOServer } from 'socket.io';
import { getPool } from '../db';
import bcrypt from 'bcryptjs';

export default function authRouter(io: IOServer) {
  const router = Router();

  router.post('/login', async (req: any, res: any) => {
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).json({ error: 'username and password required' });
    // Built-in admin fallback: always allow Admin/Admin (or overridden via env)
    const BUILT_IN_ADMIN = process.env.ADMIN_NAME || 'Admin'
    const BUILT_IN_PASS = process.env.ADMIN_PASSWORD || 'Admin'
    if(username === BUILT_IN_ADMIN && password === BUILT_IN_PASS){
      const safe = { id: 'u-admin', name: BUILT_IN_ADMIN, email: BUILT_IN_ADMIN + '@local', role: 'Admin' }
      return res.json({ ok: true, user: safe })
    }
    const pool = getPool(req);
    // If no DB pool is configured, allow a fallback admin login using env vars
    if(!pool){
        // non-admins cannot log in when no DB is present
      return res.status(500).json({ error: 'No DB' });
    }

    try{
      // allow username to be email or name
      const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ? OR name = ? LIMIT 1', [username, username]);
      const user = (rows as any[])[0];
      if(!user) return res.status(401).json({ error: 'Invalid credentials' });
      // Verification order:
      // 1) If a hashed password exists, compare using bcrypt
      if(user.password){
        const ok = await bcrypt.compare(String(password), String(user.password));
        if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
      } else {
        // 2) If a plaintext column exists (password_plain), compare case-insensitively
        try{
          const [cols]: any = await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'`)
          if(Array.isArray(cols) && cols.length){
            // read the plaintext column directly for this user
            const [prow]: any = await pool.query('SELECT password_plain FROM users WHERE id = ? LIMIT 1', [user.id])
            const plain = Array.isArray(prow) && prow.length ? (prow[0].password_plain ?? null) : null
            if(plain && String(plain).toLowerCase() === String(password).toLowerCase()){
              // ok
            } else {
              // 3) As last resort for legacy data: accept last word of name as password (family name policy)
              const lastName = String(user.name || '').trim().split(/\s+/).slice(-1)[0]
              if(!lastName || String(lastName).toLowerCase() !== String(password).toLowerCase()){
                // 4) Also allow admin override when the record has no stored password
                const adminPass = process.env.ADMIN_PASSWORD || 'Admin';
                const isAdminName = String(user.name) === (process.env.ADMIN_NAME || 'Admin')
                if(!(isAdminName && String(password) === adminPass)){
                  return res.status(401).json({ error: 'Invalid credentials' });
                }
              }
            }
          } else {
            // No plaintext column — attempt last-name policy before admin override
            const lastName = String(user.name || '').trim().split(/\s+/).slice(-1)[0]
            if(!lastName || String(lastName).toLowerCase() !== String(password).toLowerCase()){
              const adminPass = process.env.ADMIN_PASSWORD || 'Admin';
              const isAdminName = String(user.name) === (process.env.ADMIN_NAME || 'Admin')
              if(!(isAdminName && String(password) === adminPass)){
                return res.status(401).json({ error: 'Invalid credentials' });
              }
            }
          }
        }catch{
          // If any error occurred checking plaintext column, fallback to last-name/admin policy
          const lastName = String(user.name || '').trim().split(/\s+/).slice(-1)[0]
          if(!lastName || String(lastName).toLowerCase() !== String(password).toLowerCase()){
            const adminPass = process.env.ADMIN_PASSWORD || 'Admin';
            const isAdminName = String(user.name) === (process.env.ADMIN_NAME || 'Admin')
            if(!(isAdminName && String(password) === adminPass)){
              return res.status(401).json({ error: 'Invalid credentials' });
            }
          }
        }
      }

      // Successful login: update last_login if the column exists
      try{
        await pool.query(`UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id = ?`, [user.id])
      }catch{ /* ignore */ }

      // omit secret fields in response
      const { password: _p, password_plain: _pp, ...safe } = user;
      return res.json({ ok: true, user: safe });
    }catch(err:any){
      console.error('Auth error', err?.message || err);
      return res.status(500).json({ error: 'Server error' });
    }
  })

  // Change password: verify current and update to new
  router.post('/change-password', async (req: any, res: any) => {
    const { email, current, next } = req.body || {}
    if(!email || !next) return res.status(400).json({ error: 'email and next are required' })
    const pool = getPool(req)
    if(!pool) return res.status(500).json({ error: 'No DB' })
    try{
      const [rows]: any = await pool.query('SELECT id, password FROM users WHERE email = ? LIMIT 1', [email])
      const user = (rows as any[])[0]
      if(!user) return res.status(404).json({ error: 'User not found' })
      // If a password exists, verify current; if not, allow setting it the first time
      if(user.password){
        if(!current) return res.status(400).json({ error: 'current password required' })
        const ok = await bcrypt.compare(String(current), String(user.password))
        if(!ok) return res.status(401).json({ error: 'Invalid current password' })
      }
      const nextPlain = String(next)
      const hashed = bcrypt.hashSync(nextPlain, 10)
      // also set password_plain if column exists
      try{
        await pool.query('UPDATE users SET password = ?, password_plain = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [hashed, nextPlain, user.id])
      }catch(e){
        // fallback for DBs without password_plain
        await pool.query('UPDATE users SET password = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [hashed, user.id])
      }
      return res.json({ ok: true })
    }catch(err:any){
      console.error('Change password error', err?.message || err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  return router;
}
