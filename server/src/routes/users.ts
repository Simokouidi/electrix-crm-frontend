import { Router } from 'express';
import { Server as IOServer } from 'socket.io';
import { getPool } from '../db';
import { validatePayload } from '../schema';
import bcrypt from 'bcryptjs';
import { sendMail } from '../services/mailer';

export default function usersRouter(io: IOServer) {
  const router = Router();

  function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
  function normalizeRow(row: any){
    if(!row || typeof row !== 'object') return row
    const out: any = {}
    for(const k of Object.keys(row)) out[snakeToCamel(k)] = row[k]
    // unify capitalized Phone -> phone
    if(out.phone === undefined && (row as any).Phone !== undefined) out.phone = (row as any).Phone
    if(out.id) out.id = String(out.id)
    if('password' in out) delete out.password
    if('passwordPlain' in out) delete out.passwordPlain
    return out
  }

  function getEnumAllowed(schema: any[] | null, colName: string): string[] | null {
    if(!schema) return null
    const col = schema.find((c:any)=>String(c.name).toLowerCase()===colName.toLowerCase())
    const ct = col?.columnType || col?.COLUMN_TYPE
    if(ct && String(ct).startsWith('enum(')){
      const enumBody = String(ct).replace(/^enum\(/,'').replace(/\)$/,'')
      return enumBody.split(',').map((s:string)=>s.trim().replace(/^'/,'').replace(/'$/,''))
    }
    return null
  }

  function simplifyRole(r?: string){
    const s = (r || '').toString().trim().toLowerCase()
    // Preserve canonical roles we support: User, Admin, Owner
    if(s === 'owner') return 'Owner'
    if(s === 'admin' || s === 'administrator' || s === 'superadmin' || s === 'super admin' || s === 'root' || s === 'founder' || s === 'ceo') return 'Admin'
    if(s === 'user') return 'User'
    // Default to User when unknown
    return 'User'
  }

  function normalizeEnumsForPayload(payload:any, schema:any|null){
    if(!schema) return
    // role
    const roleAllowed = getEnumAllowed(schema, 'role')
    if(roleAllowed && payload.role !== undefined){
      const val = String(payload.role)
      if(!roleAllowed.includes(val)){
        const simplified = simplifyRole(val)
        payload.role = roleAllowed.includes(simplified) ? simplified : roleAllowed[0]
      }
    }
    // status
    const statusAllowed = getEnumAllowed(schema, 'status')
    if(statusAllowed && payload.status !== undefined){
      const val = String(payload.status)
      if(!statusAllowed.includes(val)){
        const norm = /^active$/i.test(val) ? 'Active' : (/^suspend/i.test(val) ? 'Suspended' : (/^remove/i.test(val) ? 'Removed' : (statusAllowed[0] || val)))
        payload.status = statusAllowed.includes(norm) ? norm : statusAllowed[0]
      }
    }
  }

  // Resolve requester from headers, if provided, to enforce basic RLS
  async function getAuthUser(req: any){
    const pool = getPool(req)
    if(!pool) return null
    const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
    const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
    if(!hdrId && !hdrEmail) return null
    try{
      const schema:any[] | null = (req.app as any).schema?.users || null
      const cols = Array.isArray(schema) ? schema.map((c:any)=> String(c.name)) : []
      const hasCol = (n:string)=> cols.includes(n)
      const teamCol = hasCol('team') ? 'team' : (hasCol('Team') ? 'Team' : (hasCol('market') ? 'market' : (hasCol('Market') ? 'Market' : null)))
      let sql = `SELECT id, name, email, role, ${teamCol ? ('`'+teamCol+'`') : 'NULL'} AS team FROM users WHERE `
      let params:any[] = []
      if(hdrId){ sql += ' id = ?'; params.push(hdrId) }
      if(hdrEmail){ sql += hdrId ? ' OR LOWER(email) = LOWER(?)' : ' LOWER(email) = LOWER(?)'; params.push(hdrEmail) }
      sql += ' LIMIT 1'
      const [rows]: any = await pool.query(sql, params)
      return Array.isArray(rows) && rows.length ? rows[0] : null
    }catch{ return null }
  }

  router.get('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.json({ data: [] });
    // Build SELECT dynamically based on available columns in schema
    const schema:any[] | null = (req.app as any).schema?.users || null
    const cols = Array.isArray(schema) ? schema.map((c:any)=> String(c.name)) : []
    const hasCol = (n:string)=> cols.includes(n)
    const teamCol = hasCol('team') ? 'team' : (hasCol('Team') ? 'Team' : (hasCol('market') ? 'market' : (hasCol('Market') ? 'Market' : null)))
    const phoneCol = hasCol('phone') ? 'phone' : (hasCol('Phone') ? 'Phone' : null)
    const managerCol = hasCol('manager_id') ? 'manager_id' : null
    const selectParts = [
      'id','name','role','email',
      phoneCol ? `\`${phoneCol}\` AS phone` : 'NULL AS phone',
      teamCol ? `\`${teamCol}\` AS team` : 'NULL AS team',
      hasCol('personal_email') ? '`personal_email`' : 'NULL AS personal_email',
      managerCol ? `\`${managerCol}\` AS manager_id` : 'NULL AS manager_id',
      hasCol('status') ? '`status`' : 'NULL AS status',
      hasCol('last_login') ? '`last_login`' : 'NULL AS last_login',
      hasCol('created_at') ? '`created_at`' : 'NULL AS created_at',
      hasCol('updated_at') ? '`updated_at`' : 'NULL AS updated_at'
    ]
    const sqlList = `SELECT ${selectParts.join(', ')} FROM users`
    const [rows] = await pool.query(sqlList);
    try{
      let mapped = Array.isArray(rows) ? (rows as any[]).map(normalizeRow) : rows
      // Enforce DB-driven RLS
      const auth = await getAuthUser(req)
      if(auth && Array.isArray(mapped)){
        const role = String(auth.role || '').toLowerCase()
        if(role === 'owner'){
          // see everything
        } else if(role === 'admin'){
          const norm = (s:any)=> String(s||'').toLowerCase().replace(/\s+/g,' ').trim()
          const adminTeam = norm(auth.team)
          if(adminTeam.includes('all market')){
            // All Markets Admin: show admins and users (not owners)
            mapped = mapped.filter((u:any)=> String((u.role||'')).toLowerCase() !== 'owner')
          } else if(adminTeam){
            // Market Admin: see self + user-level in same market
            mapped = mapped.filter((u:any)=>{
              const isSelf = String(u.id) === String(auth.id)
              const r = String((u.role||'')).toLowerCase()
              const isUserLevel = r !== 'owner' && r !== 'admin'
              const sameTeam = norm((u as any).team) === adminTeam
              return isSelf || (isUserLevel && sameTeam)
            })
          } else {
            // Fallback: if team cannot be resolved, behave like All Markets (exclude owners) but keep self
            mapped = mapped.filter((u:any)=> String(u.id) === String(auth.id) || String((u.role||'')).toLowerCase() !== 'owner')
          }
        } else {
          mapped = mapped.filter((u:any)=> String(u.id) === String(auth.id))
        }
      }
      res.json({ data: mapped })
    }catch(e){ res.json({ data: rows }) }
  });

  // Get a single user (safe fields only)
  router.get('/:id', async (req: any, res: any) => {
    const pool = getPool(req)
    if(!pool) return res.status(500).json({ error: 'No DB' })
    const id = req.params.id
    try{
      const schema:any[] | null = (req.app as any).schema?.users || null
      const cols = Array.isArray(schema) ? schema.map((c:any)=> String(c.name)) : []
      const hasCol = (n:string)=> cols.includes(n)
      const teamCol = hasCol('team') ? 'team' : (hasCol('Team') ? 'Team' : (hasCol('market') ? 'market' : (hasCol('Market') ? 'Market' : null)))
      const phoneCol = hasCol('phone') ? 'phone' : (hasCol('Phone') ? 'Phone' : null)
      const selectParts = [
        'id','name','role','email',
        phoneCol ? `\`${phoneCol}\` AS phone` : 'NULL AS phone',
        teamCol ? `\`${teamCol}\` AS team` : 'NULL AS team',
        hasCol('personal_email') ? '`personal_email`' : 'NULL AS personal_email',
        hasCol('status') ? '`status`' : 'NULL AS status',
        hasCol('last_login') ? '`last_login`' : 'NULL AS last_login',
        hasCol('created_at') ? '`created_at`' : 'NULL AS created_at',
        hasCol('updated_at') ? '`updated_at`' : 'NULL AS updated_at'
      ]
      const sqlOne = `SELECT ${selectParts.join(', ')} FROM users WHERE id = ?`
      const [rows]: any = await pool.query(sqlOne, [id])
      const row = Array.isArray(rows) ? rows[0] : rows
      if(!row) return res.status(404).json({ error: 'Not found' })
      return res.json({ data: normalizeRow(row) })
    }catch(err:any){
      console.error('Failed to fetch user:', err?.message || err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  // Get secrets for a user (returns password_plain only)
  router.get('/:id/secret', async (req: any, res: any) => {
    const pool = getPool(req)
    if(!pool) return res.status(500).json({ error: 'No DB' })
    const id = req.params.id
    try{
      // Check if column exists, then select
      const [cols]: any = await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'`)
      if(!Array.isArray(cols) || cols.length === 0){
        return res.json({ data: { password_plain: null } })
      }
      const [rows]: any = await pool.query('SELECT password_plain FROM users WHERE id = ? LIMIT 1', [id])
      if(!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'Not found' })
      const { password_plain } = rows[0] || { password_plain: null }
      return res.json({ data: { password_plain: password_plain ?? null } })
    }catch(err:any){
      console.error('Failed to fetch user secret:', err?.message || err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  router.post('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const { name, email, role } = req.body;
    // Simple validation using live schema mapping if present
    const schema = (req.app as any).schema?.users || null
    const payload:any = {}
    if(schema){
      const lower = (s:string)=>String(s||'').toLowerCase()
      for(const col of schema){
        const colName = col.name
        if(['id','created_at','updated_at'].includes(colName)) continue
        // direct match
        if(req.body[colName] !== undefined){ payload[colName] = req.body[colName]; continue }
        // special mappings
        if(colName === 'last_login' && req.body.lastLogin !== undefined){ payload[colName] = req.body.lastLogin; continue }
        if(lower(colName) === 'phone'){
          if(req.body.phone !== undefined) { payload[colName] = req.body.phone; continue }
          if(req.body.Phone !== undefined) { payload[colName] = req.body.Phone; continue }
        }
        if(colName === 'team' && req.body.team !== undefined){ payload[colName] = req.body.team; continue }
        // camelCase fallback
        const camel = snakeToCamel(colName)
        const lowerCamel = camel.charAt(0).toLowerCase() + camel.slice(1)
        if(req.body[camel] !== undefined){ payload[colName] = req.body[camel]; continue }
        if(req.body[lowerCamel] !== undefined){ payload[colName] = req.body[lowerCamel]; continue }
      }
      // Type coercion (dates, datetimes, enums, ints)
      try{
        for(const col of schema){
          const name = col.name
          if(payload[name] === undefined || payload[name] === null) continue
          const dt = String(col.dataType || '').toLowerCase()
          const val = payload[name]
          if(dt === 'date'){
            const d = new Date(val); if(!isNaN(d.getTime())) payload[name] = d.toISOString().slice(0,10)
          } else if(dt === 'datetime' || dt === 'timestamp'){
            const d = new Date(val); if(!isNaN(d.getTime())){
              const pad=(n:number)=>String(n).padStart(2,'0')
              payload[name] = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            }
          } else if(dt.includes('int')){
            const n = Number(val); if(!isNaN(n)) payload[name] = Math.trunc(n)
          }
        }
      }catch(e){ /* ignore coercion errors */ }
      // Defaults if not provided
      if(payload.status === undefined) payload.status = 'Active'
      if(payload.role === undefined) payload.role = 'Other'
      if(payload.name === undefined && email) payload.name = String(email).split('@')[0]
  // Coerce enums to allowed values before validation
  normalizeEnumsForPayload(payload, schema)
  const errors = validatePayload(schema, payload)
      if(errors.length) return res.status(400).json({ code: 'ERR_VALIDATION', message: 'Payload validation failed', details: errors })
    } else {
      payload.name = name
      payload.email = email
      payload.role = role || 'Other'
      if(req.body.status) payload.status = req.body.status
      if(req.body.phone) payload.phone = req.body.phone
      if(req.body.team) payload.team = req.body.team
      if(req.body.lastLogin) payload.last_login = req.body.lastLogin
    }

    // Preserve plaintext for verification, then set password_plain and hash into password if provided
    const plaintextPassword = payload.password ? String(payload.password) : null
    if(payload.password){
      try{ 
        // also store plaintext in a dedicated column (if exists) for operational needs
        (payload as any).password_plain = plaintextPassword
        payload.password = bcrypt.hashSync(String(payload.password), 10) 
      }catch{ /* ignore */ }
    }

    const cols = Object.keys(payload).filter(k=>payload[k] !== undefined)
    if(cols.length === 0) return res.status(400).json({ code: 'ERR_NO_FIELDS', message: 'No fields provided' })
    const columnsSql = cols.map(c=>`\`${c}\``).join(', ')
    const placeholders = cols.map(_=>'?').join(', ')
    const params = cols.map(c=>payload[c])
    const sql = `INSERT INTO users (${columnsSql}) VALUES (${placeholders})`
    try{
      const [r]: any = await pool.query(sql, params)
      const id = r.insertId
      const schema:any[] | null = (req.app as any).schema?.users || null
      const cols = Array.isArray(schema) ? schema.map((c:any)=> String(c.name)) : []
      const hasCol = (n:string)=> cols.includes(n)
      const teamCol = hasCol('team') ? 'team' : (hasCol('Team') ? 'Team' : (hasCol('market') ? 'market' : (hasCol('Market') ? 'Market' : null)))
      const phoneCol = hasCol('phone') ? 'phone' : (hasCol('Phone') ? 'Phone' : null)
      const selectParts = [
        'id','name','role','email',
        phoneCol ? `\`${phoneCol}\` AS phone` : 'NULL AS phone',
        teamCol ? `\`${teamCol}\` AS team` : 'NULL AS team',
        hasCol('personal_email') ? '`personal_email`' : 'NULL AS personal_email',
        hasCol('status') ? '`status`' : 'NULL AS status',
        hasCol('last_login') ? '`last_login`' : 'NULL AS last_login',
        hasCol('created_at') ? '`created_at`' : 'NULL AS created_at',
        hasCol('updated_at') ? '`updated_at`' : 'NULL AS updated_at',
        hasCol('password') ? '`password`' : 'NULL AS password'
      ]
      const sqlSel = `SELECT ${selectParts.join(', ')} FROM users WHERE id = ?`
      const [rows] = await pool.query(sqlSel, [id])
      const created = (rows as any[])[0]
      const mapped = normalizeRow(created)
      let passwordVerified: boolean | undefined = undefined
      if(plaintextPassword){
        try{
          // Verify the stored hash matches the plaintext we received
          const ok = created && created.password ? await bcrypt.compare(plaintextPassword, created.password) : false
          passwordVerified = !!ok
        }catch{ passwordVerified = false }
      }
      // Attempt to send credentials email (non-blocking)
      try{
        const toEmailCorp = String(mapped?.email || '')
        const toEmailPersonal = String((mapped as any)?.personalEmail || (created as any)?.personal_email || '')
        const toRecipients = [toEmailCorp, toEmailPersonal].filter(Boolean)
        if(toRecipients.length && plaintextPassword){
          const originHeader = (req.headers['origin'] as string) || ''
          const refererHeader: string = (req.headers['referer'] as string) || ''
          const refererOrigin = refererHeader ? (refererHeader.match(/^https?:\/\/[^/]+/)?.[0] || '') : ''
          const origin = originHeader || refererOrigin || process.env.APP_ORIGIN || 'http://localhost:5175'
          const changeUrl = `${origin}/change-password?email=${encodeURIComponent(toEmailCorp)}`
          const subject = 'Your ELECTRIX CRM access has been set up'
          const text = `Hello,\n\nYour ELECTRIX CRM access has been set up.\n\nEmail: ${toEmailCorp}\nTemporary password: ${plaintextPassword}\n\nPlease sign in and change your password here:\n${changeUrl}\n\nThank you,\nELECTRIX Admin`
          const esc = (s:string)=> String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          const html = `
            <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;">
              <h2 style="margin:0 0 12px 0;font-size:18px;">${esc(subject)}</h2>
              <p>Hello,</p>
              <p>Your ELECTRIX CRM access has been set up.</p>
              <p><strong>Email:</strong> ${esc(toEmailCorp)}<br/>
                 <strong>Temporary password:</strong> ${esc(plaintextPassword || '')}</p>
              <p>Please sign in and change your password here:<br/>
                 <a href="${esc(changeUrl)}" target="_blank" rel="noreferrer">${esc(changeUrl)}</a></p>
              <p>Thank you,<br/>ELECTRIX Admin</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
              <p style="margin:2px 0;color:#6b7280;">This is an automated message from ELECTRIX CRM.</p>
            </div>
          `
          // fire-and-forget
          sendMail({ to: toRecipients, subject, text, html }).catch((e:any)=>{
            console.warn('[Users][Email] Failed to send credentials:', e?.message || e)
          })
        }
      }catch(_e){ /* ignore email errors */ }
      io.emit('users:created', mapped)
      res.status(201).json({ data: mapped, meta: { passwordVerified } })
    }catch(err:any){
      console.error('Failed to insert user:', err?.message || err)
      if(err && err.code === 'ER_DUP_ENTRY') return res.status(400).json({ code: 'ERR_DUPLICATE', message: 'email must be unique' })
      return res.status(500).json({ code: 'ERR_DB_INSERT', message: 'DB insert failed', details: String(err?.message || err) })
    }
  });

  router.put('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    const schema = (req.app as any).schema?.users || null
    const payload:any = {}
    if(schema){
      const lower = (s:string)=>String(s||'').toLowerCase()
      for(const col of schema){
        const colName = col.name
        if(['id','created_at','updated_at'].includes(colName)) continue
        if(req.body[colName] !== undefined){ payload[colName] = req.body[colName]; continue }
        if(colName === 'last_login' && req.body.lastLogin !== undefined){ payload[colName] = req.body.lastLogin; continue }
        if(lower(colName) === 'phone'){
          if(req.body.phone !== undefined){ payload[colName] = req.body.phone; continue }
          if(req.body.Phone !== undefined){ payload[colName] = req.body.Phone; continue }
        }
        if(colName === 'team' && req.body.team !== undefined){ payload[colName] = req.body.team; continue }
        const camel = snakeToCamel(colName)
        const lowerCamel = camel.charAt(0).toLowerCase() + camel.slice(1)
        if(req.body[camel] !== undefined){ payload[colName] = req.body[camel]; continue }
        if(req.body[lowerCamel] !== undefined){ payload[colName] = req.body[lowerCamel]; continue }
      }
      // Type coercion
      try{
        for(const col of schema){
          const name = col.name
          if(payload[name] === undefined || payload[name] === null) continue
          const dt = String(col.dataType || '').toLowerCase()
          const val = payload[name]
          if(dt === 'date'){
            const d = new Date(val); if(!isNaN(d.getTime())) payload[name] = d.toISOString().slice(0,10)
          } else if(dt === 'datetime' || dt === 'timestamp'){
            const d = new Date(val); if(!isNaN(d.getTime())){
              const pad=(n:number)=>String(n).padStart(2,'0')
              payload[name] = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            }
          } else if(dt.includes('int')){
            const n = Number(val); if(!isNaN(n)) payload[name] = Math.trunc(n)
          }
        }
      }catch(e){ /* ignore coercion errors */ }
      // For PUT, allow partial updates: only validate/coerce provided fields, do not enforce required
      normalizeEnumsForPayload(payload, schema)
    } else {
      Object.assign(payload, req.body)
    }
    // Preserve plaintext for verification, then set password_plain and hash into password if provided
    const plaintextPassword = payload.password ? String(payload.password) : null
    if(payload.password){
      try{ 
        (payload as any).password_plain = plaintextPassword
        payload.password = bcrypt.hashSync(String(payload.password), 10) 
      }catch{ /* ignore */ }
    }
    const cols = Object.keys(payload).filter(k=>k !== 'id' && payload[k] !== undefined)
    if(cols.length === 0) return res.status(400).json({ code: 'ERR_NO_FIELDS', message: 'No fields to update' })
    const setSql = cols.map(c=>`\`${c}\` = ?`).join(', ')
    const params = cols.map(c=>payload[c])
    params.push(id)
    const sql = `UPDATE users SET ${setSql}, updated_at = UTC_TIMESTAMP() WHERE id = ?`
    try{
      await pool.query(sql, params)
      const [rows] = await pool.query(`
        SELECT id, name, role, email,
               CASE WHEN EXISTS(
                 SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'Phone'
               ) THEN Phone ELSE phone END AS phone,
               team,
               CASE WHEN EXISTS(
                 SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'personal_email'
               ) THEN personal_email ELSE NULL END AS personal_email,
               status, last_login, created_at, updated_at, password
        FROM users WHERE id = ?
      `, [id])
      const updated = (rows as any[])[0]
      const mapped = normalizeRow(updated)
      let passwordVerified: boolean | undefined = undefined
      if(plaintextPassword){
        try{
          const ok = updated && updated.password ? await bcrypt.compare(plaintextPassword, updated.password) : false
          passwordVerified = !!ok
        }catch{ passwordVerified = false }
      }
      io.emit('users:updated', mapped)
      res.json({ data: mapped, meta: { passwordVerified } })
    }catch(err:any){
      console.error('Failed to update user:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_UPDATE', message: 'DB update failed', details: String(err?.message || err) })
    }
  });

  router.delete('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    try{
  await pool.query('DELETE FROM users WHERE id = ?', [id])
  io.emit('users:deleted', { id: String(id) })
  res.json({ data: { id: String(id) } })
    }catch(err:any){
      console.error('Failed to delete user:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_DELETE', message: 'DB delete failed', details: String(err?.message || err) })
    }
  });

  return router;
}
