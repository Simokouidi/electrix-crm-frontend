import { Router } from 'express'
import type { Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try{
    const pool = getPool(req)
    if(!pool) return res.status(503).json({ success: false, error: 'DB unavailable' })

    const { user_id, activity_type, activity_details, session_id, time_spent_seconds } = req.body || {}
    if(!user_id || !activity_type || !session_id){
      return res.status(400).json({ success: false, error: 'Missing user_id, activity_type or session_id' })
    }

    const detailsStr = typeof activity_details === 'string' ? activity_details : JSON.stringify(activity_details ?? {})
    const seconds = Number.isFinite(Number(time_spent_seconds)) ? Number(time_spent_seconds) : null

    // Determine current database name and ensure the usage table exists in that schema
    const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
    const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
    const fqTable = `\`${dbName}\`.\`usage\``

    // Ensure table exists (id BIGINT AI PK, fields as specified)
    const createSql = `
      CREATE TABLE IF NOT EXISTS ${fqTable} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id VARCHAR(64) NOT NULL,
        activity_type VARCHAR(64) NOT NULL,
        activity_details TEXT NULL,
        session_id VARCHAR(64) NOT NULL,
        time_spent_seconds INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user (user_id),
        INDEX idx_session (session_id),
        INDEX idx_type (activity_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
    await pool.query(createSql)

    const insertSql = `
      INSERT INTO ${fqTable}
        (user_id, activity_type, activity_details, session_id, time_spent_seconds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `
    const [result]: any = await pool.execute(insertSql, [
      String(user_id),
      String(activity_type),
      detailsStr,
      String(session_id),
      seconds
    ])
    return res.json({ success: true, id: result?.insertId ?? null })
  }catch(err:any){
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

export default router

// Debug helper: fetch recent usage rows for verification (development only)
router.get('/recent', async (req: Request, res: Response) => {
  try{
    const pool = getPool(req)
    if(!pool) return res.status(503).json({ success: false, error: 'DB unavailable' })
    const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
    const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
    const fqTable = `\`${dbName}\`.\`usage\``
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)))
    const [rows]: any = await pool.query(`SELECT * FROM ${fqTable} ORDER BY id DESC LIMIT ?`, [limit])
    return res.json({ success: true, data: rows })
  }catch(err:any){
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})
