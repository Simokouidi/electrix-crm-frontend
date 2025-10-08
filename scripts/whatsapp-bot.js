// whatsapp-web.js bot with a small HTTP API for cloud deployment
// Usage (local): npm install whatsapp-web.js qrcode-terminal express
// Start: node ./scripts/whatsapp-bot.js
// In Docker we install runtime deps in Dockerfile.
const { Client, LocalAuth } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')
const qrcode = require('qrcode-terminal')
const express = require('express')
const cors = require('cors')

const PORT = process.env.PORT || 3002
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-secret'

// Persist LocalAuth data inside the working folder so docker volume can map it
// Use .local-auth to match docker-compose volume (./whatsapp-data:/app/.local-auth)
const AUTH_DIR = process.env.WWJS_AUTH_DIR || path.join(process.cwd(), '.local-auth')
console.log('[WhatsApp] Using auth directory:', AUTH_DIR)

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'crm-bot', dataPath: AUTH_DIR }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
})

let clientReady = false
let latestQr = null

client.on('qr', qr => {
  // show QR in terminal for first-time scan
  qrcode.generate(qr, { small: true })
  console.log('Scan the QR above with WhatsApp mobile app (Linked devices -> Link a device)')
  latestQr = qr
})

client.on('ready', () => {
  clientReady = true
  console.log('WhatsApp client ready')
  latestQr = null
})

client.on('authenticated', () => console.log('Authenticated'))
client.on('auth_failure', msg => {
  console.error('Auth failed', msg)
  // Exit so orchestrator restarts the container and re-initializes
  setTimeout(() => process.exit(1), 1000)
})

client.on('disconnected', (reason) => {
  clientReady = false
  console.warn('Client disconnected:', reason)
  // On disconnect, next initialize() will emit a fresh QR
  setTimeout(() => process.exit(1), 1000)
})

client.initialize()

// Small Express API to accept send requests from your cloud app
const app = express()
app.use(express.json())
// allow requests from the app (development) or other origins when running in cloud
app.use(cors())

app.get('/health', (req, res) => res.json({ status: 'ok', ready: clientReady }))

function checkAuth(req){
  const h = req.headers.authorization || ''
  if(!h.startsWith('Bearer ')) return false
  const token = h.slice(7).trim()
  return token === BOT_API_KEY
}

app.post('/send', async (req, res) => {
  if(!checkAuth(req)) return res.status(401).json({ error: 'unauthorized' })
  if(!clientReady) return res.status(503).json({ error: 'not ready' })
  const { to, message } = req.body || {}
  if(!to || !message) return res.status(400).json({ error: 'missing to or message' })

  // Normalize destination: remove leading + and append @c.us if missing
  let dest = String(to).replace(/^\+/, '')
  if(!dest.includes('@')) dest = dest + '@c.us'

  try{
    const sent = await client.sendMessage(dest, message)
    return res.json({ ok: true, id: sent.id?.id || null })
  }catch(err){
    console.error('Send error', err)
    return res.status(500).json({ error: String(err) })
  }
})

// Return latest QR string for scanning in UI (protected)
app.get('/qr', (req, res) => {
  if(!checkAuth(req)) return res.status(401).json({ error: 'unauthorized' })
  if(clientReady) return res.json({ qr: null, ready: true })
  return res.json({ qr: latestQr || null, ready: false })
})

// Import session: upload LocalAuth files (base64) and restart to use them
// Body format: { files: [{ path: "Session-.../somefile", dataBase64: "..." }, ...], force?: true }
app.post('/import-session', async (req, res) => {
  if(!checkAuth(req)) return res.status(401).json({ error: 'unauthorized' })
  try{
    const files = Array.isArray(req.body?.files) ? req.body.files : null
    const force = !!req.body?.force
    if(!files || files.length === 0) return res.status(400).json({ error: 'no files provided' })

    // If auth dir already has content and not forcing, refuse to overwrite
    const hasContent = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR, { withFileTypes: true }).length > 0
    if(hasContent && !force){
      return res.status(409).json({ error: 'auth dir is not empty; pass force=true to overwrite' })
    }

    for(const f of files){
      const rel = String(f.path || '').replace(/^\\+|^\/+/, '')
      if(!rel || rel.includes('..')) continue
      const target = path.join(AUTH_DIR, rel)
      const dir = path.dirname(target)
      await fs.promises.mkdir(dir, { recursive: true })
      const data = Buffer.from(String(f.dataBase64 || ''), 'base64')
      await fs.promises.writeFile(target, data)
    }

    // Ack first, then restart so the client re-initializes with the imported session
    res.json({ ok: true, message: 'session imported; restarting' })
    setTimeout(() => process.exit(0), 500)
  }catch(err){
    console.error('Import session failed', err)
    return res.status(500).json({ error: 'import failed', details: String(err?.message || err) })
  }
})

app.listen(PORT, () => console.log(`WhatsApp bot HTTP API listening on port ${PORT}`))
