import { Router } from 'express'
import path from 'path'
import { spawn } from 'child_process'
import http from 'http'
import https from 'https'

function httpGetJson(url: string, headers?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://')
    const mod = isHttps ? https : http
    const req = mod.request(url, { method: 'GET', headers: headers || {} }, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({})
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function isBotUp(): Promise<boolean> {
  try {
    const j = await httpGetJson('http://127.0.0.1:3002/health')
    return !!(j && j.ready !== undefined)
  } catch {
    return false
  }
}

function startBotProcess(): { pid?: number } {
  try {
    // __dirname is server/src/routes -> project root is three levels up
    const rootDir = path.resolve(__dirname, '../../../')
    const scriptPath = path.join(rootDir, 'scripts', 'whatsapp-bot.js')
    const env = { ...process.env }
    if (!env.BOT_API_KEY) env.BOT_API_KEY = 'dev-secret'
    if (!env.WWJS_AUTH_DIR) env.WWJS_AUTH_DIR = path.join(rootDir, '.local-auth')
    if (!env.PORT) env.PORT = '3002'
    const child = spawn(process.execPath, [scriptPath], {
      cwd: rootDir,
      env,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    return { pid: child.pid }
  } catch {
    return {}
  }
}

export default function botRouter() {
  const router = Router()

  router.get('/health', async (_req, res) => {
    const up = await isBotUp()
    return res.json({ up })
  })

  router.post('/start', async (_req, res) => {
    const already = await isBotUp()
    if (already) return res.json({ started: false, alreadyRunning: true })
    const r = startBotProcess()
    return res.json({ started: true, pid: r.pid || null })
  })

  router.get('/qr', async (_req, res) => {
    // Ensure bot is up (best-effort)
    if (!(await isBotUp())) startBotProcess()

    const key = process.env.BOT_API_KEY || 'dev-secret'
    const headers = { Authorization: `Bearer ${key}` }
    const begin = Date.now()
    const timeoutMs = 20000
    const intervalMs = 500
    let last: any = null

    while (Date.now() - begin < timeoutMs) {
      try {
        const j = await httpGetJson('http://127.0.0.1:3002/qr', headers)
        last = j
        if (j && (j.ready === true || (typeof j.qr === 'string' && j.qr.length > 0))) {
          return res.json(j)
        }
      } catch {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    // Return last seen state if available, else timeout
    if (last) return res.json(last)
    return res.status(504).json({ error: 'timeout waiting for qr' })
  })

  return router
}
