import { Pool } from 'mysql2/promise'

type Column = { COLUMN_NAME: string, DATA_TYPE: string, COLUMN_TYPE: string, IS_NULLABLE: 'YES' | 'NO', COLUMN_DEFAULT: any, COLUMN_KEY: string }

export async function loadSchema(pool: Pool){
  const [usersCols]: any = await pool.query(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`)
  const [clientsCols]: any = await pool.query(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'`)
  const [activitiesCols]: any = await pool.query(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities'`)
  const [usageCols]: any = await pool.query(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_activity'`)

  function map(cols:any[]){
    return cols.map((c:any)=>({ name: c.COLUMN_NAME, dataType: c.DATA_TYPE, columnType: c.COLUMN_TYPE, nullable: c.IS_NULLABLE === 'YES', default: c.COLUMN_DEFAULT, key: c.COLUMN_KEY }))
  }

  return {
    users: map(usersCols),
    clients: map(clientsCols),
    activities: map(activitiesCols),
    user_activity: map(usageCols),
  }
}

export function validatePayload(tableSchema:any[], payload:any){
  const errors:any[] = []
  for(const col of tableSchema){
    const name = col.name
    const nullable = col.nullable
    const dt = col.dataType
    const value = payload[name] !== undefined ? payload[name] : undefined
    if(!nullable && (value === undefined || value === null) && !['created_at','updated_at','id'].includes(name)){
      errors.push({ field: name, reason: 'REQUIRED' })
    }
    if(value !== undefined && value !== null){
      if(dt.includes('int')){ if(isNaN(Number(value))) errors.push({ field: name, reason: 'MUST_BE_INT' }) }
      if(dt === 'decimal'){ if(isNaN(Number(value))) errors.push({ field: name, reason: 'MUST_BE_DECIMAL' }) }
      if(dt === 'enum' || col.columnType?.startsWith('enum(')){
        const enumBody = col.columnType.replace(/^enum\(/,'').replace(/\)$/,'')
        const allowed = enumBody.split(',').map((s:string)=>s.replace(/'^|'$/g,'').replace(/^\'/,'').replace(/\'$/,''))
        if(!allowed.includes(String(value))) errors.push({ field: name, reason: 'INVALID_ENUM', allowed })
      }
    }
  }
  return errors
}
