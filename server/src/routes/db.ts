import { Router } from 'express'
import { createPool } from 'mysql2/promise'

const router = Router()

router.get('/check', async (req: any, res: any) => {
  // If a pool is attached to the app, use it
  const pool = (req.app as any).db
  if(pool){
    try{
      const [rows] = await pool.query('SELECT 1 as ok')
      return res.json({ ok: true, db: true, msg: 'Pool available', rows })
    }catch(err:any){
      return res.status(500).json({ ok: false, db: true, error: String(err?.message || err) })
    }
  }

  // No pool attached — try to connect using env vars if present
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(!url) return res.status(400).json({ ok: false, db: false, error: 'No MYSQL_URL / DATABASE_URL configured in environment' })
  let tmp
  try{
    tmp = createPool({ uri: url, connectionLimit: 2 })
    const [rows] = await tmp.query('SELECT 1 as ok')
    await tmp.end()
    return res.json({ ok: true, db: true, msg: 'Connected via env DATABASE_URL', rows })
  }catch(err:any){
    try{ if(tmp) await tmp.end() }catch(e){}
    return res.status(500).json({ ok: false, db: false, error: String(err?.message || err) })
  }
})

export default router
