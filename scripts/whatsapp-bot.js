// whatsapp-web.js bot with a small HTTP API for cloud deployment
// Usage (local): npm install whatsapp-web.js qrcode-terminal express
// Start: node ./scripts/whatsapp-bot.js
// In Docker we install runtime deps in Dockerfile.
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const express = require('express')
const cors = require('cors')

const PORT = process.env.PORT || 3002
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-secret'

// Persist LocalAuth data inside the working folder so docker volume can map it
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'crm-bot' }),
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

client.on('qr', qr => {
  // show QR in terminal for first-time scan
  qrcode.generate(qr, { small: true })
  console.log('Scan the QR above with WhatsApp mobile app (Linked devices -> Link a device)')
})

client.on('ready', () => {
  clientReady = true
  console.log('WhatsApp client ready')
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

app.listen(PORT, () => console.log(`WhatsApp bot HTTP API listening on port ${PORT}`))
