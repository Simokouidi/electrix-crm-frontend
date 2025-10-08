import { Router } from 'express'
import type { Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

// Helper: resolve a fully-qualified usage table name, preferring `usage_logs` then `user_usage`, then legacy `usage` (quoted)
async function resolveUsageTable(pool: any): Promise<string> {
  const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
  const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
  const target = `\`${dbName}\`.\`usage_logs\``
  const safe = `\`${dbName}\`.\`user_usage\``
  const legacy = `\`${dbName}\`.\`usage\``
  try{
    const [tbls]: any = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('usage_logs','user_usage','usage')"
    )
    const names = new Set((Array.isArray(tbls) ? tbls : []).map((r:any)=>String(r.TABLE_NAME)))
    if(names.has('usage_logs')) return target
    if(names.has('user_usage')) return safe
    if(names.has('usage')) return legacy
  }catch{/* ignore */}
  return target
}

// GET /api/metrics/activity-scores
// Returns rows: { user_id, name, email, activity_score, activity_health, last_activity_date }
router.get('/activity-scores', async (req: Request, res: Response) => {
  try{
    const pool = getPool(req)
    if(!pool) return res.status(503).json({ success: false, error: 'DB unavailable' })

    // Determine DB/schema name dynamically and resolve usage table
    const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
    const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
    const fqUsage = await resolveUsageTable(pool)
    const users = `\`${dbName}\`.\`users\``

    // Compute per-user last activity date and score directly from usage table
    const sql = `
      SELECT
        usr.id AS user_id,
        usr.name,
        usr.email,
        agg.last_activity_date,
        agg.activity_score,
        CASE WHEN agg.activity_score < 25 THEN 'At Risk' ELSE 'OK' END AS activity_health
      FROM (
        SELECT
          u.user_id,
          DATE(MAX(u.created_at)) AS last_activity_date,
          GREATEST(0, LEAST(30, 30 - DATEDIFF(CURDATE(), DATE(MAX(u.created_at))))) AS activity_score
        FROM ${fqUsage} u
        GROUP BY u.user_id
      ) AS agg
      JOIN ${users} usr ON CAST(usr.id AS CHAR) = CAST(agg.user_id AS CHAR)
    `
    const [rows]: any = await pool.query(sql)
    return res.json({ success: true, data: rows })
  }catch(err:any){
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

export default router
