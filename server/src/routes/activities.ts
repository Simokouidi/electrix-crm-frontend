import { Router } from 'express';
import { Server as IOServer } from 'socket.io';
// Note: avoid importing ../db to prevent TS workspace resolution conflicts; use req.app.db directly
function getPool(req: any){ return (req?.app as any)?.db }

export default function activitiesRouter(io: IOServer) {
  const router = Router();

  function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
  function normalizeRow(row: any){ if(!row || typeof row !== 'object') return row; const out:any={}; for(const k of Object.keys(row)) out[snakeToCamel(k)] = row[k]; if(out.id) out.id = String(out.id); return out }

  router.get('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.json({ data: [] });
    const db:any = pool
    const [rows] = await pool.query('SELECT * FROM activities');
    // Basic RLS using X-User headers
    async function getAuthUser(){
      try{
        const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
        const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
        if(!hdrId && !hdrEmail) return null
        const schema:any[] | null = (req.app as any).schema?.users || null
        const cols = Array.isArray(schema) ? schema.map((c:any)=> String(c.name)) : []
        const hasCol = (n:string)=> cols.includes(n)
        const teamCol = hasCol('team') ? 'team' : (hasCol('Team') ? 'Team' : (hasCol('market') ? 'market' : (hasCol('Market') ? 'Market' : null)))
        let sql = `SELECT id, email, role, ${teamCol ? ('`'+teamCol+'`') : 'NULL'} AS team FROM users WHERE `
        const params:any[] = []
        if(hdrId){ sql += ' id = ?'; params.push(hdrId) }
        if(hdrEmail){ sql += hdrId ? ' OR LOWER(email) = LOWER(?)' : ' LOWER(email) = LOWER(?)'; params.push(hdrEmail) }
        sql += ' LIMIT 1'
        const [urows]: any = await db.query(sql, params)
        return Array.isArray(urows) && urows.length ? urows[0] : null
      }catch{ return null }
    }
    async function getTeam(){
      try{
        const [teamRows]: any = await db.query('SELECT id, role, team, manager_id FROM users')
        return Array.isArray(teamRows) ? teamRows : []
      }catch{ return [] }
    }
    try{ 
      // Load users to allow robust owner resolution
      const schemaUsers:any[] | null = (req.app as any).schema?.users || null
      const colsU = Array.isArray(schemaUsers) ? schemaUsers.map((c:any)=> String(c.name)) : []
      const hasColU = (n:string)=> colsU.includes(n)
      const teamColU = hasColU('team') ? 'team' : (hasColU('Team') ? 'Team' : (hasColU('market') ? 'market' : (hasColU('Market') ? 'Market' : null)))
      const [urows]: any = await db.query(`SELECT id, email, name, role, ${teamColU ? ('`'+teamColU+'`') : 'NULL'} AS team FROM users`)
      const usersByEmail = new Map<string, any>()
      const usersByName = new Map<string, any>()
      for(const u of (Array.isArray(urows)?urows:[])){
        const email = (u.email ? String(u.email).toLowerCase() : '')
        const name = (u.name ? String(u.name).toLowerCase() : '')
        if(email) usersByEmail.set(email, u)
        if(name) usersByName.set(name, u)
      }
      const resolveOwnerId = (a:any): string =>{
        if(!a || typeof a !== 'object') return ''
        const id1 = a.ownerId ?? a.userId ?? a.owner_id ?? a.user_id
        if(id1 !== undefined && id1 !== null && String(id1) !== '') return String(id1)
        const email = (a.owner_email ?? a.user_email ?? '').toString().toLowerCase()
        if(email && usersByEmail.has(email)) return String(usersByEmail.get(email).id)
        const name = (a.Owner ?? a.owner ?? '').toString().toLowerCase()
        if(name && usersByName.has(name)) return String(usersByName.get(name).id)
        return ''
      }
      let mapped = Array.isArray(rows) ? (rows as any[]).map(normalizeRow) : rows; 
      const auth = await getAuthUser()
      if(auth && Array.isArray(mapped)){
        const role = String(auth.role||'').toLowerCase()
        if(role === 'owner'){
          // full access
        } else if(role === 'admin'){
          const norm = (s:any)=> String(s||'').toLowerCase().replace(/\s+/g,' ').trim()
          const adminTeam = norm(auth.team)
          if(adminTeam.includes('all market')){
            // full access
          } else {
            // Admin sees activities owned by users in same market, or tied to clients of those users
            const allowedOwnerIds = new Set<string>()
            for(const u of (Array.isArray(urows)?urows:[])){
              const uTeam = norm(u.team)
              const uRole = String(u.role||'').toLowerCase()
              if(uTeam === adminTeam && (uRole === 'user' || uRole === 'bdm')) allowedOwnerIds.add(String(u.id))
            }
            allowedOwnerIds.add(String(auth.id))
            const [clientRows]: any = await db.query('SELECT id, owner_id, owner_email, owner FROM clients')
            const visibleClientIds = new Set<string>()
            for(const c of (Array.isArray(clientRows)?clientRows:[])){
              const ownerId = String(c.owner_id || '') || (c.owner_email && usersByEmail.get(String(c.owner_email).toLowerCase())?.id) || (c.owner && usersByName.get(String(c.owner).toLowerCase())?.id) || ''
              if(ownerId && allowedOwnerIds.has(String(ownerId))) visibleClientIds.add(String(c.id))
            }
            mapped = mapped.filter((a:any)=> {
              const ownerId = resolveOwnerId(a)
              const clientId = a.clientId || a.client_id
              if(ownerId && allowedOwnerIds.has(String(ownerId))) return true
              if(clientId && visibleClientIds.has(String(clientId))) return true
              return false
            })
          }
        } else {
          // user-level: own activities or activities for own clients
          const selfId = String(auth.id)
          const [clientRows]: any = await db.query('SELECT id, owner_id, owner_email, owner FROM clients')
          const ownClientIds = new Set<string>()
          for(const c of (Array.isArray(clientRows)?clientRows:[])){
            const ownerId = String(c.owner_id || '') || (c.owner_email && usersByEmail.get(String(c.owner_email).toLowerCase())?.id) || (c.owner && usersByName.get(String(c.owner).toLowerCase())?.id) || ''
            if(ownerId && String(ownerId) === selfId) ownClientIds.add(String(c.id))
          }
          mapped = mapped.filter((a:any)=> {
            const ownerId = resolveOwnerId(a)
            const clientId = a.clientId || a.client_id
            if(ownerId && ownerId === selfId) return true
            if(clientId && ownClientIds.has(String(clientId))) return true
            return false
          })
        }
      }
      res.json({ data: mapped }) 
    }catch(e){ res.json({ data: rows }) }
  });

  router.post('/', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const schema = (req.app as any).schema?.activities || null
    const payload:any = {}
    const dbgPrefix = '[activities:POST]'
    const db:any = pool
    // RLS (mutations): Users cannot modify Assignment
    try{
      const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
      const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
      if(hdrId || hdrEmail){
        const [urows]: any = await db.query('SELECT id, email, role FROM users WHERE (id = ? AND ? <> "") OR (email = ? AND ? <> "") LIMIT 1', [hdrId, hdrId, hdrEmail, hdrEmail])
        const u = Array.isArray(urows) && urows.length ? urows[0] : null
        const role = String((u && u.role) || '').toLowerCase()
        const hasAssignment = (
          req.body.assignment !== undefined || req.body.Assignment !== undefined ||
          (schema && Array.isArray(schema) && schema.some((c:any)=> c.name==='assignment' && payload.assignment !== undefined))
        )
        if((role === 'user' || role === 'bdm') && hasAssignment){
          return res.status(403).json({ code: 'ERR_FORBIDDEN_ASSIGN', message: 'Users are not allowed to modify Assignment' })
        }
      }
    }catch{ /* ignore */ }
    try{ console.debug(dbgPrefix, 'incoming body =', JSON.stringify(req.body)) }catch(_){ console.debug(dbgPrefix, 'incoming body (non-json)') }
    function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
    if(schema){
      for(const col of schema){
        // skip primary key columns and timestamps
        if(col.key === 'PRI' || ['created_at','updated_at'].includes(col.name)) continue
        const camel = snakeToCamel(col.name)
        const camelLower = camel && typeof camel === 'string' ? camel.charAt(0).toLowerCase() + camel.slice(1) : camel
        if(req.body[col.name] !== undefined) payload[col.name] = req.body[col.name]
        else if(req.body[camel] !== undefined) payload[col.name] = req.body[camel]
        else if(req.body[camelLower] !== undefined) payload[col.name] = req.body[camelLower]
      }
    } else {
      payload.client_id = req.body.clientId || req.body.client_id || req.body.Client || null
      payload.user_id = req.body.userId || req.body.user_id || req.body.Owner || req.body.ownerId || null
      payload.type = req.body.type || req.body.Type || null
      payload.note = req.body.notes || req.body.note || null
      payload.status = req.body.status || req.body.Status || 'Planned'
      payload.time_spent_seconds = req.body.timeSpentSeconds || req.body.time_spent_seconds || 0
      payload.scheduled_at = req.body.datetime || req.body.Date || req.body.scheduled_at || null
    }

    // Normalize common variants so the rest of the logic can rely on canonical keys
    // Accept camelCase, snake_case and capitalized variants from clients
    try{
      // canonical fields
      payload.type = payload.type ?? payload.Type ?? payload.type
      payload.client_id = payload.client_id ?? payload.clientId ?? payload.Client ?? payload.client_id
      payload.user_id = payload.user_id ?? payload.userId ?? payload.Owner ?? payload.ownerId ?? payload.user_id
      payload.note = payload.note ?? payload.notes ?? payload.note
      payload.scheduled_at = payload.scheduled_at ?? payload.datetime ?? payload.Date ?? payload.scheduled_at
      // status normalization
      const rawStatus = (req.body.status ?? req.body.Status ?? payload.status) as string | undefined
      const normalStatus = rawStatus === 'Canceled' ? 'Cancelled' : rawStatus
      if(normalStatus) payload.status = normalStatus
      // cut-off normalization: accept many aliases
      const cutoff = req.body['cut_off_date'] ?? req.body['Cut-off'] ?? req.body['Cut off'] ?? req.body['Cut Off'] ?? req.body['Cut off date'] ?? req.body['Cut Off Date'] ?? null
      if(cutoff !== undefined){
        const cutoffStr = cutoff === null ? null : String(cutoff)
        const dateOnly = cutoffStr ? cutoffStr.slice(0,10) : null
        payload.cut_off = dateOnly
        payload.cut_off_date = dateOnly
        // If schema present, map to actual DB column name(s)
        if(schema){
          const sCols = (schema as any[]).map((c:any)=>c.name)
          const targetCols = sCols.filter((n:string)=> /cut[ _-]?off( date)?/i.test(n))
          for(const n of targetCols){ payload[n] = dateOnly }
          try{ console.debug(dbgPrefix, 'cutoff mapped to columns:', targetCols) }catch(_){/* ignore */}
        }
      }
    }catch(e){/* ignore */}
    try{ console.debug(dbgPrefix, 'normalized payload draft =', payload) }catch(_){ console.debug(dbgPrefix, 'normalized payload draft (non-loggable)') }
    // Align status to DB enum when possible (POST)
    try{
      if(schema){
        const statusCol = (schema as any[]).find((c:any)=> String(c.name).toLowerCase() === 'status')
        if(statusCol && typeof statusCol.columnType === 'string' && statusCol.columnType.startsWith('enum(')){
          const enumBody = statusCol.columnType.replace(/^enum\(/,'').replace(/\)$/,'')
          const allowed = enumBody.split(',').map((s:string)=> s.replace(/^\'/,'').replace(/\'$/,''))
          const val = (payload.status ?? payload.Status) as string | undefined
          if(val){
            let chosen = val
            if(!allowed.includes(chosen)){
              const swapped = chosen === 'Canceled' ? 'Cancelled' : (chosen === 'Cancelled' ? 'Canceled' : chosen)
              if(allowed.includes(swapped)) chosen = swapped
              else {
                const ci = allowed.find((a: string) => a.toLowerCase() === chosen.toLowerCase())
                if(ci) chosen = ci
              }
            }
            payload.status = chosen
            payload.Status = chosen
            try{ console.debug(dbgPrefix, 'status allowed =', allowed, 'chosen =', chosen) }catch(_){/* ignore */}
          }
        }
      }
    }catch(_){/* ignore */}

    // If scheduled_at is required by schema and missing, set to now (SQL format)
    try{
      if(schema){
        const schedCol = (schema as any[]).find((c:any)=> c.name === 'scheduled_at')
        if(schedCol && !schedCol.nullable && !payload.scheduled_at){
          const now = new Date();
          const nowSql = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,19).replace('T',' ')
          payload.scheduled_at = nowSql
        }
      }
    }catch(_){/* ignore */}

    // Heuristic: if DB expects numeric user_id but we received a non-numeric identifier (eg 'u-admin'),
    // attempt to resolve it to the real users.id via a lookup. Also attempt to coerce client_id to a number when appropriate.
    try{
      const userCol = (req.app as any).schema?.users?.find((c:any)=>c.name === 'id')
      const userIdIsInt = !!userCol && String(userCol.dataType || '').toLowerCase().includes('int')
      // Resolve user_id
      if(payload.user_id !== undefined && userIdIsInt){
        const uid = payload.user_id
        if(typeof uid === 'string' && Number.isNaN(Number(uid))){
          // try to find user by id/email/name
          const q = await pool.query('SELECT id FROM users WHERE id = ? OR email = ? OR name = ? LIMIT 1', [uid, uid, uid]) as any
          const found = Array.isArray(q[0]) && q[0].length ? q[0][0] : null
          if(found && found.id !== undefined){
            payload.user_id = found.id
          } else {
            // fallback: find admin user by email pattern (Admin@local) or first user
            const adminEmail = (process.env.ADMIN_NAME || 'Admin') + '@local'
            const r = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]) as any
            const adminFound = Array.isArray(r[0]) && r[0].length ? r[0][0] : null
            if(adminFound && adminFound.id !== undefined) payload.user_id = adminFound.id
            else {
              // try first user id
              const all = await pool.query('SELECT id FROM users LIMIT 1') as any
              const first = Array.isArray(all[0]) && all[0].length ? all[0][0] : null
              if(first && first.id !== undefined) payload.user_id = first.id
            }
          }
        }
      }
      // coerce client_id if numeric-like
      if(payload.client_id !== undefined && typeof payload.client_id === 'string' && !Number.isNaN(Number(payload.client_id))){
        payload.client_id = Math.trunc(Number(payload.client_id))
      }
    }catch(e){
      console.warn('User/client id resolution failed', e)
    }

    // Validate only after normalization/id resolution
    if(schema){
      const { validatePayload } = require('../schema')
      const filteredSchema = Array.isArray(schema) ? schema.filter((c:any)=> c.key !== 'PRI' && !['created_at','updated_at'].includes(c.name)) : schema
      const errors = validatePayload(filteredSchema, payload)
      if(errors.length) return res.status(400).json({ code: 'ERR_VALIDATION', message: 'Payload validation failed', details: errors, debug: { payload } })
    }

    // ensure required fields
    if(!payload.client_id || !payload.user_id || !payload.type){
      console.warn(dbgPrefix, 'missing required', { client_id: payload.client_id, user_id: payload.user_id, type: payload.type })
      return res.status(400).json({ code: 'ERR_MISSING', message: 'client_id, user_id and type required' })
    }

    let cols:string[] = []
    let params:any[] = []
    if(schema){
      const schemaCols = Array.isArray(schema) ? schema.filter((c:any)=> c.key !== 'PRI' && !['created_at','updated_at'].includes(c.name)).map((c:any)=>c.name) : []
      cols = schemaCols.filter((c:string)=> payload[c] !== undefined)
      params = cols.map(c=>payload[c])
    } else {
      cols = Object.keys(payload).filter(k=>payload[k] !== undefined)
      params = cols.map(c=>payload[c])
    }
    const columnsSql = cols.map(c=>`\`${c}\``).join(', ')
    const placeholders = cols.map(_=>'?').join(', ')
    const sql = `INSERT INTO activities (${columnsSql}) VALUES (${placeholders})`
    try{ console.debug(dbgPrefix, 'SQL:', sql, 'params:', params) }catch(_){ console.debug(dbgPrefix, 'SQL prepared') }
    try{
      const [r]: any = await pool.query(sql, params)
      // find primary key column name
      const pkCol = Array.isArray(schema) ? (schema.find((c:any)=>c.key === 'PRI') || { name: 'id' }).name : 'id'
      const insertedId = r.insertId || r.insert_id || null
      // if insertId not available, try to fetch last inserted row conservatively
      let rows:any[] = []
      if(insertedId !== null){
        const selectSql = 'SELECT * FROM activities WHERE ' + pkCol + ' = ?'
        const rr:any = await pool.query(selectSql, [insertedId])
        rows = rr[0]
      } else {
        const rr:any = await pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 1')
        rows = rr[0]
      }
      const created = (rows as any[])[0]
      const mapped = normalizeRow(created)
      io.emit('activities:created', mapped)
      res.status(201).json({ data: mapped })
    }catch(err:any){
      console.error(dbgPrefix, 'Failed to insert activity:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_INSERT', message: 'DB insert failed', details: String(err?.message || err), debug: { sql, params, payload } })
    }
  });

  router.put('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    const schema = (req.app as any).schema?.activities || null
    const payload:any = {}
    const dbgPrefix = '[activities:PUT]'
    const db:any = pool
    // RLS (mutations): Users cannot modify Assignment
    try{
      const hdrId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '') as string
      const hdrEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '') as string
      if(hdrId || hdrEmail){
        const [urows]: any = await db.query('SELECT id, email, role FROM users WHERE (id = ? AND ? <> "") OR (email = ? AND ? <> "") LIMIT 1', [hdrId, hdrId, hdrEmail, hdrEmail])
        const u = Array.isArray(urows) && urows.length ? urows[0] : null
        const role = String((u && u.role) || '').toLowerCase()
        const hasAssignment = (req.body.assignment !== undefined || req.body.Assignment !== undefined)
        if((role === 'user' || role === 'bdm') && hasAssignment){
          return res.status(403).json({ code: 'ERR_FORBIDDEN_ASSIGN', message: 'Users are not allowed to modify Assignment' })
        }
      }
    }catch{ /* ignore */ }
    try{ console.debug(dbgPrefix, 'id=', id, 'incoming body =', JSON.stringify(req.body)) }catch(_){ console.debug(dbgPrefix, 'incoming body (non-json)') }
    if(schema){
      for(const col of schema){
        if(req.body[col.name] !== undefined) payload[col.name] = req.body[col.name]
      }
      // Skip full-schema validation on PUT; we only update provided fields.
    } else {
      Object.assign(payload, req.body)
    }

    // Normalize status and cutoff for PUT as well
    try{
      const rawStatus = (req.body.status ?? req.body.Status ?? payload.status) as string | undefined
      const normalStatus = rawStatus === 'Canceled' ? 'Cancelled' : rawStatus
      if(normalStatus) payload.status = normalStatus
      const cutoff = req.body['cut_off_date'] ?? req.body['Cut-off'] ?? req.body['Cut off'] ?? req.body['Cut Off'] ?? req.body['Cut off date'] ?? req.body['Cut Off Date']
      if(cutoff !== undefined){
        const cutoffStr = cutoff === null ? null : String(cutoff)
        const dateOnly = cutoffStr ? cutoffStr.slice(0,10) : null
        payload.cut_off = dateOnly
        payload.cut_off_date = dateOnly
        if(schema){
          const sCols = (schema as any[]).map((c:any)=>c.name)
          const targetCols = sCols.filter((n:string)=> /cut[ _-]?off( date)?/i.test(n))
          for(const n of targetCols){ payload[n] = dateOnly }
          try{ console.debug(dbgPrefix, 'cutoff mapped to columns:', targetCols) }catch(_){/* ignore */}
        }
      }
    }catch(_){/* ignore */}
    // Align status to DB enum when possible (PUT)
    try{
      if(schema){
        const statusCol = (schema as any[]).find((c:any)=> String(c.name).toLowerCase() === 'status')
        if(statusCol && typeof statusCol.columnType === 'string' && statusCol.columnType.startsWith('enum(')){
          const enumBody = statusCol.columnType.replace(/^enum\(/,'').replace(/\)$/,'')
          const allowed = enumBody.split(',').map((s:string)=> s.replace(/^\'/,'').replace(/\'$/,''))
          const val = (payload.status ?? payload.Status) as string | undefined
          if(val){
            let chosen = val
            if(!allowed.includes(chosen)){
              const swapped = chosen === 'Canceled' ? 'Cancelled' : (chosen === 'Cancelled' ? 'Canceled' : chosen)
              if(allowed.includes(swapped)) chosen = swapped
              else {
                const ci = allowed.find((a: string) => a.toLowerCase() === chosen.toLowerCase())
                if(ci) chosen = ci
              }
            }
            payload.status = chosen
            payload.Status = chosen
            try{ console.debug(dbgPrefix, 'status allowed =', allowed, 'chosen =', chosen) }catch(_){/* ignore */}
          }
        }
      }
    }catch(_){/* ignore */}

    // Special case (audit requirement): If assigning a new cut-off date to a Postponed record that previously had no cut-off,
    // do NOT update the existing row. Instead, create a NEW row with status Planned and the provided cut-off.
    try{
      const pkCol = Array.isArray(schema) ? ((schema as any[]).find((c:any)=>c.key === 'PRI') || { name: 'id' }).name : 'id'
      // Determine if this request is assigning a (non-null) cutoff
      const incomingCutoffRaw = (req.body['cut_off_date'] ?? req.body['Cut-off'] ?? req.body['Cut off'] ?? req.body['Cut Off'] ?? req.body['Cut off date'] ?? req.body['Cut Off Date'] ?? payload.cut_off_date)
      const incomingCutoff = incomingCutoffRaw === undefined ? undefined : (incomingCutoffRaw === null ? null : String(incomingCutoffRaw).slice(0,10))
      if(incomingCutoff !== undefined && incomingCutoff !== null){
        const rr0:any = await pool.query('SELECT * FROM activities WHERE ' + pkCol + ' = ? LIMIT 1', [id])
        const existing = Array.isArray(rr0[0]) && rr0[0].length ? rr0[0][0] : null
        if(existing){
          const existingStatus = (existing.status ?? existing.Status)
          const existingCutoff = (existing.cut_off_date ?? existing['Cut-off'] ?? existing['Cut off'] ?? existing['Cut Off'] ?? existing['Cut off date'] ?? existing['Cut Off Date'] ?? null)
          const wasPostponed = String(existingStatus || '').toLowerCase() === 'postponed'
          const hadNoCutoff = existingCutoff == null || existingCutoff === ''
          if(wasPostponed && hadNoCutoff){
            const now = new Date();
            const nowIso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString()
            const nowSql = nowIso.slice(0,19).replace('T',' ')
            // Build insert payload taking fields from existing row
            const insertPayload:any = {}
            // Prefer schema-driven mapping where available
            if(schema){
              const sCols = (schema as any[]).map((c:any)=>c.name)
              const setIf = (col:string, val:any)=>{ if(val !== undefined) insertPayload[col] = val }
              // copy core identifiers and details
              setIf('client_id', (existing.client_id ?? existing.clientId))
              setIf('user_id', (existing.user_id ?? existing.userId ?? existing.owner_id ?? existing.ownerId))
              setIf('type', (existing.type ?? existing.Type))
              setIf('title', (existing.title ?? existing.Title))
              setIf('note', (existing.note ?? existing.notes ?? existing.Note ?? existing.Notes))
              setIf('assignment', (existing.assignment ?? existing.Assignment))
              setIf('status', 'Planned')
              setIf('cut_off_date', incomingCutoff)
              // map to cut_off variants present in schema
              const targetCols = sCols.filter((n:string)=> /cut[ _-]?off( date)?/i.test(n))
              for(const n of targetCols){ insertPayload[n] = incomingCutoff }
              // set scheduled_at if present and required
              if(sCols.includes('scheduled_at')) insertPayload['scheduled_at'] = nowSql
            } else {
              insertPayload.client_id = (existing.client_id ?? existing.clientId)
              insertPayload.user_id = (existing.user_id ?? existing.userId ?? existing.owner_id ?? existing.ownerId)
              insertPayload.type = (existing.type ?? existing.Type)
              insertPayload.title = (existing.title ?? existing.Title)
              insertPayload.note = (existing.note ?? existing.notes ?? existing.Note ?? existing.Notes)
              insertPayload.assignment = (existing.assignment ?? existing.Assignment)
              insertPayload.status = 'Planned'
              insertPayload.cut_off_date = incomingCutoff
              insertPayload.scheduled_at = nowSql
            }

            // Prepare INSERT similar to POST route
            const insertCols = Object.keys(insertPayload).filter(k=> insertPayload[k] !== undefined && !['created_at','updated_at', pkCol].includes(k))
            const columnsSql = insertCols.map(c=>`\`${c}\``).join(', ')
            const placeholders = insertCols.map(_=>'?').join(', ')
            const params = insertCols.map(c=>insertPayload[c])
            const sqlIns = `INSERT INTO activities (${columnsSql}) VALUES (${placeholders})`
            try{ console.debug(dbgPrefix, '[append] SQL:', sqlIns, 'params:', params) }catch(_){/* ignore */}
            const [rIns]: any = await pool.query(sqlIns, params)
            // Fetch the inserted row
            let rows:any[] = []
            const insertedId = rIns.insertId || rIns.insert_id || null
            if(insertedId !== null){
              const selectSql = 'SELECT * FROM activities WHERE ' + pkCol + ' = ?'
              const rr:any = await pool.query(selectSql, [insertedId])
              rows = rr[0]
            } else {
              const rr:any = await pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 1')
              rows = rr[0]
            }
            const created = (rows as any[])[0]
            const mapped = normalizeRow(created)
            io.emit('activities:created', mapped)
            return res.status(201).json({ data: mapped })
          }
        }
      }
    }catch(err){ try{ console.warn(dbgPrefix, 'append-on-cutoff check failed', err) }catch(_){/* ignore */} }

    let cols = Object.keys(payload).filter(k=>k !== 'id' && payload[k] !== undefined)
    if(schema){
      const allowed = new Set((schema as any[]).map((c:any)=>c.name))
      cols = cols.filter(c => allowed.has(c))
    }
    if(cols.length === 0) return res.status(400).json({ code: 'ERR_NO_FIELDS', message: 'No fields to update' })
    const setSql = cols.map(c=>`\`${c}\` = ?`).join(', ')
    const params = cols.map(c=>payload[c])
    params.push(id)
    try{
      const schema = (req.app as any).schema?.activities || null
      const pkCol = Array.isArray(schema) ? (schema.find((c:any)=>c.key === 'PRI') || { name: 'id' }).name : 'id'
      const sql = `UPDATE activities SET ${setSql}, updated_at = UTC_TIMESTAMP() WHERE ${pkCol} = ?`
      try{ console.debug(dbgPrefix, 'SQL:', sql, 'params:', params) }catch(_){ console.debug(dbgPrefix, 'SQL prepared') }
      await pool.query(sql, params)
      const rr:any = await pool.query('SELECT * FROM activities WHERE ' + pkCol + ' = ?', [id])
      const updated = rr[0] && rr[0][0] ? rr[0][0] : rr[0]
      const mapped = normalizeRow(updated)
      io.emit('activities:updated', mapped)
      res.json({ data: mapped })
    }catch(err:any){
      console.error(dbgPrefix, 'Failed to update activity:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_UPDATE', message: 'DB update failed', details: String(err?.message || err), debug: { setSql, params, payload } })
    }
  });

  router.delete('/:id', async (req: any, res: any) => {
    const pool = getPool(req);
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const id = req.params.id;
    try{
      const schema = (req.app as any).schema?.activities || null
      const pkCol = Array.isArray(schema) ? (schema.find((c:any)=>c.key === 'PRI') || { name: 'id' }).name : 'id'
      await pool.query('DELETE FROM activities WHERE ' + pkCol + ' = ?', [id])
      io.emit('activities:deleted', { id: String(id) })
      res.json({ data: { id: String(id) } })
      }catch(err:any){
      console.error('Failed to delete activity:', err?.message || err)
      return res.status(500).json({ code: 'ERR_DB_DELETE', message: 'DB delete failed', details: String(err?.message || err) })
    }
  });

  return router;
}
