import { Router } from 'express'
import type { Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

// GET /api/metrics/activity-scores
// Returns rows: { user_id, name, email, activity_score, activity_health, last_activity_date }
router.get('/activity-scores', async (req: Request, res: Response) => {
  try{
    const pool = getPool(req)
    if(!pool) return res.status(503).json({ success: false, error: 'DB unavailable' })

    // Determine DB/schema name dynamically
    const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
    const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
    // Prefer view built on user_usage; fallback to v_usage_activity if present
    const view = `\`${dbName}\`.\`v_usage_activity\``
    const users = `\`${dbName}\`.\`users\``

    const sql = `
      SELECT usr.id AS user_id, usr.name, usr.email,
             v.activity_score, v.activity_health, v.last_activity_date
      FROM ${view} v
      JOIN ${users} usr ON CAST(usr.id AS CHAR) = CAST(v.user_id AS CHAR)
    `
    const [rows]: any = await pool.query(sql)
    return res.json({ success: true, data: rows })
  }catch(err:any){
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

export default router
