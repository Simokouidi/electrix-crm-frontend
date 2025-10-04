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
      // if password column exists, verify; otherwise accept if role is Admin and password matches ADMIN_PASSWORD env var
      if(user.password){
        const ok = await bcrypt.compare(password, user.password);
        if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
      } else {
        // no stored password: fallback to check against ADMIN_PASSWORD env if name matches
        const adminPass = process.env.ADMIN_PASSWORD || 'Admin';
        if(user.name !== (process.env.ADMIN_NAME || 'Admin') || password !== adminPass) return res.status(401).json({ error: 'Invalid credentials' });
      }

      // omit password in response
      const { password: _p, ...safe } = user;
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
