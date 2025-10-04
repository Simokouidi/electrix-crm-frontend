import { Router } from 'express';
import { Server as IOServer } from 'socket.io';
import { getPool } from '../db';

export default function clientsRouter(io: IOServer) {
  const router = Router();

  // helper: convert snake_case -> camelCase for socket/API consistency
  function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
  function normalizeRow(row: any){
    if(!row || typeof row !== 'object') return row
    const out: any = {}
    for(const k of Object.keys(row)){
      out[snakeToCamel(k)] = row[k]
    }
    // Stabilize id: prefer explicit id; else fall back to common PK variants like clientId
    if(out.id !== undefined && out.id !== null){
      out.id = String(out.id)
    } else if(out.clientId !== undefined && out.clientId !== null){
      out.id = String(out.clientId)
    }
    return out
  }

  router.get('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.json({ data: [] });
    const db:any = pool
    const [rows] = await pool.query('SELECT * FROM clients');
    // Determine primary key column name for clients table (fallback to 'id')
    const schema = (req.app as any).schema?.clients || null
    const pkCol = (schema && Array.isArray(schema) ? (schema.find((c:any)=> String(c.key||'').toUpperCase()==='PRI')?.name) : null) || 'id'
    // Basic RLS: use X-User-Id / X-User-Email to scope results
    async function getAuthUser(){
      try{
        const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
        const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
        if(!hdrId && !hdrEmail) return null
        const [urows]: any = await db.query('SELECT id, email, role, team FROM users WHERE (id = ? AND ? <> "") OR (email = ? AND ? <> "") LIMIT 1', [hdrId, hdrId, hdrEmail, hdrEmail])
        return Array.isArray(urows) && urows.length ? urows[0] : null
      }catch{ return null }
    }
    try{
      let mapped = Array.isArray(rows) ? (rows as any[]).map(r => {
        const m = normalizeRow(r)
        if(m && (m.id === undefined || m.id === null) && r && r[pkCol] !== undefined && r[pkCol] !== null){
          m.id = String(r[pkCol])
        }
        return m
      }) : rows
      const auth = await getAuthUser()
      if(auth && Array.isArray(mapped)){
        const role = String(auth.role || '').toLowerCase()
        if(role === 'owner'){
          // full access
        } else if(role === 'admin'){
          const adminTeam = String(auth.team || '').toLowerCase()
          if(adminTeam.includes('all market')){
            // full access
          } else if(adminTeam){
            // filter by same team owners or users reporting to admin
            // We need a list of user ids by team/manager; fetch minimal fields
            try{
              const [teamRows]: any = await db.query('SELECT id, role, team, manager_id FROM users')
              const allowedOwnerIds = new Set<string>()
              for(const u of teamRows){
                const roleLower = String(u.role||'').toLowerCase()
                const uTeam = String(u.team||'').toLowerCase()
                const reportsTo = u.manager_id != null ? String(u.manager_id) : ''
                const isUserLevel = roleLower === 'user' || roleLower === 'bdm'
                const sameMarket = uTeam === adminTeam
                const reportsToAdmin = reportsTo && reportsTo === String(auth.id)
                if(isUserLevel && (sameMarket || reportsToAdmin)) allowedOwnerIds.add(String(u.id))
              }
              allowedOwnerIds.add(String(auth.id))
              mapped = mapped.filter((c:any)=> allowedOwnerIds.has(String(c.ownerId || c.owner_id)))
            }catch{
              // If users.manager_id is missing or query failed, fallback to same-team only using users table
              try{
                const [sameTeamUsers]: any = await db.query('SELECT id, role FROM users WHERE LOWER(team) = ?', [adminTeam])
                const allowedOwnerIds = new Set<string>()
                for(const u of (Array.isArray(sameTeamUsers) ? sameTeamUsers : [])){
                  const roleLower = String(u.role||'').toLowerCase()
                  const isUserLevel = roleLower === 'user' || roleLower === 'bdm'
                  if(isUserLevel) allowedOwnerIds.add(String(u.id))
                }
                allowedOwnerIds.add(String(auth.id))
                mapped = mapped.filter((c:any)=> allowedOwnerIds.has(String(c.ownerId || c.owner_id)))
              }catch{
                // Last-resort: restrict to admin's own clients
                mapped = mapped.filter((c:any)=> String(c.ownerId || c.owner_id) === String(auth.id))
              }
            }
          } else {
            mapped = mapped.filter((c:any)=> String(c.ownerId || c.owner_id) === String(auth.id))
          }
        } else {
          mapped = mapped.filter((c:any)=> String(c.ownerId || c.owner_id) === String(auth.id))
        }
      }
      return res.json({ data: mapped })
    }catch(e){
      return res.json({ data: rows })
    }
  });

  router.post('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    // validate against live schema mapping if present
    const schema = (req.app as any).schema?.clients || null
    const pkCol = (schema && Array.isArray(schema) ? (schema.find((c:any)=> String(c.key||'').toUpperCase()==='PRI')?.name) : null) || 'id'
    // build payload using DB column names (snake_case) when schema is available
    function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
    function camelToSnake(s: string){ return s.replace(/([A-Z])/g, '_$1').toLowerCase() }
    const payload:any = {}
    if(schema){
      for(const col of schema){
        if(['id','created_at','updated_at'].includes(col.name)) continue
        // prefer explicit DB-named field, then camelCase browser field
        if(req.body[col.name] !== undefined) payload[col.name] = req.body[col.name]
        else {
          const camel = snakeToCamel(col.name)
          if(req.body[camel] !== undefined) payload[col.name] = req.body[camel]
          else if(req.body[camel.charAt(0).toLowerCase() + camel.slice(1)] !== undefined) payload[col.name] = req.body[camel.charAt(0).toLowerCase() + camel.slice(1)]
        }
        // apply default values reported by schema when available
        if(payload[col.name] === undefined && col.default !== null && col.default !== undefined) payload[col.name] = col.default
      }
      const { validatePayload } = require('../schema')
      // Coerce common types to DB-friendly formats (dates, datetimes, ints, booleans, decimals)
      try{
        for(const col of schema){
          const name = col.name
          if(payload[name] === undefined || payload[name] === null) continue
          const dt = String(col.dataType || '').toLowerCase()
          const val = payload[name]
          if(dt === 'date'){
            // Accept ISO strings; convert to YYYY-MM-DD
            const d = new Date(val)
            if(!isNaN(d.getTime())) payload[name] = d.toISOString().slice(0,10)
          } else if(dt === 'datetime' || dt === 'timestamp'){
            const d = new Date(val)
            if(!isNaN(d.getTime())){
              const pad = (n:number)=>String(n).padStart(2,'0')
              const yyyy = d.getFullYear()
              const mm = pad(d.getMonth()+1)
              const dd = pad(d.getDate())
              const hh = pad(d.getHours())
              const mi = pad(d.getMinutes())
              const ss = pad(d.getSeconds())
              payload[name] = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
            }
          } else if(dt.includes('int')){
            const n = Number(val)
            if(!isNaN(n)) payload[name] = Math.trunc(n)
          } else if(dt === 'tinyint' && String(col.columnType || '').startsWith('tinyint(1')){
            // boolean-like
            if(typeof val === 'boolean') payload[name] = val ? 1 : 0
            else if(val === 'true' || val === '1' || val === 1) payload[name] = 1
            else payload[name] = 0
          } else if(dt === 'decimal' || dt === 'double' || dt === 'float'){
            const f = Number(val)
            if(!isNaN(f)) payload[name] = f
          }
          // Convert array-ish inputs (e.g., servicesInterested) into a comma-separated string for text/varchar columns
          if(Array.isArray(payload[name]) && (dt === 'varchar' || dt === 'text' || dt === 'tinytext' || dt === 'mediumtext' || dt === 'longtext' || dt === 'enum' || dt === 'set')){
            payload[name] = (payload[name] as any[]).map(v => (v == null ? '' : String(v))).filter(s => s.length > 0).join(', ')
          }
        }
      }catch(e){ console.warn('Type coercion failed', e) }

      // If owner_id is required but missing, default from RLS headers when available
      try{
        const needOwnerId = schema.some((c:any)=>c.name==='owner_id' && c.nullable===false)
        if(needOwnerId && (payload.owner_id === undefined || payload.owner_id === null || payload.owner_id === '')){
          const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
          if(hdrId) payload.owner_id = hdrId
        }
        // Also map owner_email if missing from header email
        if(payload.owner_email === undefined || payload.owner_email === null){
          const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
          if(hdrEmail) payload.owner_email = hdrEmail
        }
      }catch{ /* ignore */ }

      const errors = validatePayload(schema, payload)
      if(errors.length) return res.status(400).json({ code: 'ERR_VALIDATION', message: 'Payload validation failed', details: errors })
    } else {
      // fallback: try common fields
      payload.client_name = req.body.clientName || req.body.client_name
      payload.phone = req.body.phone
      payload.email = req.body.email
      // Best-effort mapping for owner fields
      payload.owner_id = req.body.ownerId || req.body.owner_id || (req.headers['x-user-id'] as string) || (req.headers['X-User-Id'] as string)
      payload.owner_email = req.body.ownerEmail || req.body.owner_email || (req.headers['x-user-email'] as string) || (req.headers['X-User-Email'] as string)
      // Convert array-ish servicesInterested to string
      const si = (req.body.servicesInterested || req.body.services_interested)
      if(Array.isArray(si)) payload.services_interested = si.map((v:any)=>String(v)).join(', ')
    }

    // build insert query dynamically (only provided fields)
    const cols = Object.keys(payload).filter(k=>payload[k] !== undefined)
    if(cols.length === 0) return res.status(400).json({ code: 'ERR_NO_FIELDS', message: 'No client fields provided' })
    const placeholders = cols.map(_=>'?').join(', ')
    const columnsSql = cols.map(c=>`\`${c}\``).join(', ')
    const params = cols.map(c=>payload[c])
    const sql = `INSERT INTO clients (${columnsSql}) VALUES (${placeholders})`
    try{
      const [r]: any = await pool.query(sql, params)
      const id = r.insertId
      const [rows] = await pool.query(`SELECT * FROM clients WHERE \`${pkCol}\` = ?`, [id])
      const created = (rows as any[])[0]
      let mapped = normalizeRow(created)
      if(mapped && (mapped.id === undefined || mapped.id === null)) mapped.id = String(created?.[pkCol] ?? id)
      io.emit('clients:created', mapped)
      res.status(201).json({ data: mapped })
    }catch(err:any){
      console.error('Failed to insert client:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_INSERT', message: 'DB insert failed', details: String(err?.message || err) })
    }
  });

  router.put('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    const schema = (req.app as any).schema?.clients || null
    const pk = (schema && Array.isArray(schema) ? (schema.find((c:any)=> String(c.key||'').toUpperCase()==='PRI') || null) : null)
    const pkCol = (pk && pk.name) || 'id'
    function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
    const payload:any = {}
    if(schema){
      // Load existing row so we can validate against a full record (partial update support)
      try{
        const [existRows]: any = await pool.query(`SELECT * FROM clients WHERE \`${pkCol}\` = ? LIMIT 1`, [id])
        if(!Array.isArray(existRows) || existRows.length === 0){
          return res.status(404).json({ code: 'NOT_FOUND', message: 'Client not found' })
        }
        (req as any).__existingClientRow = existRows[0]
      }catch(err:any){
        console.warn('Failed to load existing client row for validation', err?.message || err)
      }
      for(const col of schema){
        if(req.body[col.name] !== undefined) payload[col.name] = req.body[col.name]
        else {
          const camel = snakeToCamel(col.name)
          if(req.body[camel] !== undefined) payload[col.name] = req.body[camel]
        }
      }
      const { validatePayload } = require('../schema')
      // Coerce common types and arrays similar to POST route
      try{
        for(const col of schema){
          const name = col.name
          const dt = String(col.dataType || '').toLowerCase()
          if(payload[name] === undefined || payload[name] === null) continue
          if(Array.isArray(payload[name]) && (dt === 'varchar' || dt === 'text' || dt === 'tinytext' || dt === 'mediumtext' || dt === 'longtext' || dt === 'enum' || dt === 'set')){
            payload[name] = (payload[name] as any[]).map(v => (v == null ? '' : String(v))).filter(s => s.length > 0).join(', ')
            continue
          }
          if(dt === 'date'){
            const d = new Date(payload[name])
            if(!isNaN(d.getTime())) payload[name] = d.toISOString().slice(0,10)
          } else if(dt === 'datetime' || dt === 'timestamp'){
            const d = new Date(payload[name])
            if(!isNaN(d.getTime())){
              const pad = (n:number)=>String(n).padStart(2,'0')
              const yyyy = d.getFullYear()
              const mm = pad(d.getMonth()+1)
              const dd = pad(d.getDate())
              const hh = pad(d.getHours())
              const mi = pad(d.getMinutes())
              const ss = pad(d.getSeconds())
              payload[name] = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
            }
          } else if(dt.includes('int')){
            const n = Number(payload[name])
            if(!isNaN(n)) payload[name] = Math.trunc(n)
          } else if(dt === 'tinyint' && String(col.columnType || '').startsWith('tinyint(1')){
            const v = payload[name]
            if(typeof v === 'boolean') payload[name] = v ? 1 : 0
            else if(v === 'true' || v === '1' || v === 1) payload[name] = 1
            else payload[name] = 0
          } else if(dt === 'decimal' || dt === 'double' || dt === 'float'){
            const f = Number(payload[name])
            if(!isNaN(f)) payload[name] = f
          }
        }
      }catch{ /* ignore */ }
      // Merge existing row values for missing fields so required columns pass validation
      const existing = (req as any).__existingClientRow || {}
      const mergedForValidation: any = { ...existing, ...payload }
      const errors = validatePayload(schema, mergedForValidation)
      if(errors.length) return res.status(400).json({ code: 'ERR_VALIDATION', message: 'Payload validation failed', details: errors })
    } else {
      Object.assign(payload, req.body)
      // Best-effort: array to string for services
      if(Array.isArray(payload.servicesInterested)) payload.servicesInterested = (payload.servicesInterested as any[]).map(v=>String(v)).join(', ')
    }

    const cols = Object.keys(payload).filter(k=>k !== 'id' && payload[k] !== undefined)
    if(cols.length === 0) return res.status(400).json({ code: 'ERR_NO_FIELDS', message: 'No fields to update' })
    const setSql = cols.map(c=>`\`${c}\` = ?`).join(', ')
    const params = cols.map(c=>payload[c])
    params.push(id)
    const sql = `UPDATE clients SET ${setSql}, updated_at = UTC_TIMESTAMP() WHERE \`${pkCol}\` = ?`
    try{
      await pool.query(sql, params)
      const [rows] = await pool.query(`SELECT * FROM clients WHERE \`${pkCol}\` = ?`, [id])
      const updated = (rows as any[])[0]
      let mapped = normalizeRow(updated)
      if(mapped && (mapped.id === undefined || mapped.id === null)) mapped.id = String(updated?.[pkCol] ?? id)
      io.emit('clients:updated', mapped)
      res.json({ data: mapped })
    }catch(err:any){
      console.error('Failed to update client:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_UPDATE', message: 'DB update failed', details: String(err?.message || err) })
    }
  });

  router.delete('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    const schema = (req.app as any).schema?.clients || null
    const pkCol = (schema && Array.isArray(schema) ? (schema.find((c:any)=> String(c.key||'').toUpperCase()==='PRI')?.name) : null) || 'id'
    try{
  await pool.query(`DELETE FROM clients WHERE \`${pkCol}\` = ?`, [id])
  io.emit('clients:deleted', { id: String(id) })
  res.json({ data: { id: String(id) } })
    }catch(err:any){
      console.error('Failed to delete client:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_DELETE', message: 'DB delete failed', details: String(err?.message || err) })
    }
  });

  return router;
}
