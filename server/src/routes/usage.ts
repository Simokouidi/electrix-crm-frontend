import { Router } from 'express'
import type { Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

// Resolve a safe table name for usage events. Prefer `user_usage` (not reserved),
// fall back to legacy reserved name `usage` if it already exists and cannot be renamed.
async function resolveUsageTable(pool: any): Promise<string> {
  const [dbRows]: any = await pool.query('SELECT DATABASE() AS db')
  const dbName = (Array.isArray(dbRows) && dbRows.length ? String(dbRows[0].db || dbRows[0].DB || '') : '').trim() || 'railway'
  const safe = `\`${dbName}\`.\`user_usage\``
  const legacy = `\`${dbName}\`.\`usage\``
  try{
    const [tbls]: any = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('user_usage','usage')"
    )
    const names = new Set((Array.isArray(tbls) ? tbls : []).map((r:any)=>String(r.TABLE_NAME)))
    const hasSafe = names.has('user_usage')
    const hasLegacy = names.has('usage')
    if(hasSafe){ return safe }
    if(hasLegacy){
      // Try to rename legacy reserved table to safe name
      try{
        await pool.query('RENAME TABLE `usage` TO `user_usage`')
        return safe
      }catch{
        // No privileges or still in use — keep using legacy but fully quoted
        return legacy
      }
    }
    // Neither exists — we will create the safe one
    return safe
  }catch{
    // As a last resort, use the safe name; creation will follow
    return safe
  }
}

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

  // Determine target table (prefer non-reserved name) and ensure it exists
  const fqTable = await resolveUsageTable(pool)

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
    const fqTable = await resolveUsageTable(pool)
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)))
    const [rows]: any = await pool.query(`SELECT * FROM ${fqTable} ORDER BY id DESC LIMIT ?`, [limit])
    return res.json({ success: true, data: rows })
  }catch(err:any){
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})
