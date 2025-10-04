import type { Pool } from 'mysql2/promise'

// Lightweight helper to access the configured MySQL pool from Express app
// Attach happens in src/index.ts: (app as any).db = createPool(...)
export function getPool(req: any): Pool | undefined {
  return (req?.app as any)?.db as Pool | undefined
}

// Optional strict accessor (unused but handy)
export function requirePool(req: any): Pool {
  const pool = getPool(req)
  if (!pool) throw new Error('Database pool not available on app (req.app.db)')
  return pool
}
