import { Pool } from 'mysql2/promise';
import express from 'express';

export function getPool(req: express.Request): Pool | undefined {
  return (req.app as any).db as Pool | undefined;
}
