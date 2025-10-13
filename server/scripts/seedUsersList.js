const { createPool } = require('mysql2/promise')

// Map roles not present in enum to allowed values
function normalizeRole(role){
  const allowed = new Set(['Admin','BDM','Sales Rep','Executive','Other'])
  if(allowed.has(role)) return role
  if(role === 'Manager') return 'Executive'
  if(role === 'Service') return 'Other'
  return 'Other'
}

function toSqlDateTime(s){
  const d = new Date(s)
  if(isNaN(d.getTime())) return null
  const pad = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function randomPhone(){
  // UAE-like placeholder: +9715XXXXXXXX
  let n = '+9715'
  for(let i=0;i<7;i++) n += Math.floor(Math.random()*10)
  return n
}

// Provided users
const INPUT = [
  { name:'Simo Kouidi', email:'Simo.kouidi@electrixspace.com', phone:null, role:'Admin', team:'Executive', last_login:'9/10/2025, 5:00:00 PM' },
  { name:'Andrea Di Palma', email:'andrea.dipalma@electrixspace.com', phone:null, role:'Admin', team:'Delivery', last_login:'9/9/2025, 7:12:00 PM' },
  { name:'Mohammad Jazzar', email:'Mohammad.Jazzar@electrixspace.com', phone:null, role:'Admin', team:'BD', last_login:'9/8/2025, 4:45:00 PM' },
  { name:'Youssef Boussetta', email:'Youssef.boussetta@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'9/1/2025, 6:20:00 PM' },
  { name:'Mohammed Wasim', email:'Mohammed.Wasim@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/28/2025, 8:00:00 PM' },
  { name:'Mohammed Ali', email:'Mohammed.Ali@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/25/2025, 5:30:00 PM' },
  { name:'Eslam El Malah', email:'Eslam.elmalah@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/20/2025, 10:50:00 PM' },
  { name:'Arman Aras', email:'Arman.Aras@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/18/2025, 5:15:00 PM' },
  { name:'Abdulfattah Aljamal', email:'Abdulfattah.aljamal@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/15/2025, 4:30:00 PM' },
  { name:'Sami Alsawaftah', email:'Sami.alsawaftah@electrixspace.com', phone:null, role:'BDM', team:'BD', last_login:'8/13/2025, 12:00:00 AM' },
  { name:'Christopher Poon', email:'Christopher.poon@electrixspace.com', phone:null, role:'Manager', team:'BD', last_login:'8/10/2025, 5:00:00 PM' },
  { name:'ELECTRIX', email:'careforce@electrixspace.com', phone:null, role:'Service', team:'', last_login:'7/1/2025, 4:00:00 PM' },
]

async function main(){
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL
  if(!url){
    console.error('Please set MYSQL_URL or DATABASE_URL to connect to MySQL')
    process.exit(2)
  }
  const pool = createPool({ uri: url, connectionLimit: 5 })
  try{
    const sql = `
      INSERT INTO users (name, email, role, team, last_login, status, Phone)
      VALUES (?, ?, ?, ?, ?, 'Active', ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = VALUES(role),
        team = VALUES(team),
        last_login = VALUES(last_login),
        status = 'Active',
        Phone = VALUES(Phone)
    `
    for(const u of INPUT){
      const role = normalizeRole(u.role)
      const phone = u.phone || randomPhone()
      const lastLogin = toSqlDateTime(u.last_login)
      const params = [u.name, u.email, role, u.team || null, lastLogin, phone]
      await pool.query(sql, params)
      console.log('Upserted', u.email, '->', role, phone)
    }
    console.log('All users upserted with Active status')
  }catch(err){
    console.error('Bulk upsert failed:', err && err.message ? err.message : err)
    process.exit(3)
  }finally{
    await pool.end()
  }
}

main().catch(e=>{ console.error(e); process.exit(1) })
