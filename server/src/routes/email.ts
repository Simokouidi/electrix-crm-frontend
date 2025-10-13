import { Router } from 'express'
import { sendMail } from '../services'

const router = Router()

// Lightweight health endpoint to verify SMTP configuration presence (no secrets exposed)
router.get('/health', async (_req, res) => {
  try{
    const host = process.env.SMTP_HOST || ''
    const port = process.env.SMTP_PORT || ''
    const user = process.env.SMTP_USER || ''
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || (String(port) === '465')
    const ok = !!(host && port && user)
    return res.json({ ok, smtp: { host: !!host, port: !!port, user: !!user, secure } })
  }catch(e:any){
    return res.status(500).json({ ok: false, error: e?.message || 'health failed' })
  }
})

// Token-protected test endpoint to send a sample email from the server environment
router.post('/test', async (req, res) => {
  const token = (req.headers['x-crm-token'] as string) || ''
  const allowed = (process.env.EMAIL_TOKEN || process.env.CONTACT_TOKEN || '')
  const inDev = String(process.env.NODE_ENV || '').toLowerCase() !== 'production'
  if(!inDev && (!allowed || token !== allowed)){
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }
  const to = (req.body && req.body.to) || process.env.TEST_TO || process.env.SMTP_USER || ''
  if(!to) return res.status(400).json({ ok: false, error: 'Missing to' })
  try{
    const info = await sendMail({ to, subject: 'Electrix CRM test email', text: 'Hello from Electrix CRM server /api/email/test' })
    return res.json({ ok: true, messageId: info.messageId })
  }catch(e:any){
    return res.status(500).json({ ok: false, error: e?.message || 'send failed' })
  }
})

router.post('/send', async (req, res) => {
  const { to, subject, text, html, cc, bcc, from } = req.body || {}
  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ ok: false, error: 'Missing required fields: to, subject, and one of text or html' })
  }
  // 1) Try SMTP first
  try {
    const info = await sendMail({ to, subject, text, html, cc, bcc, from })
    return res.json({ ok: true, messageId: info.messageId })
  } catch (err: any) {
    const msg = err?.message || ''
    console.warn('[Email][SMTP] Failed, attempting fallback:', msg)
  }

  // 2) Fallback: forward to a legacy contact endpoint if configured
  try {
    const CONTACT_DEFAULT = 'https://careforce-contact-backend-47e3076b508c.herokuapp.com/contact'
    const endpoint = process.env.EMAIL_ENDPOINT || process.env.CONTACT_ENDPOINT || CONTACT_DEFAULT
    const toList: string[] = (Array.isArray(to) ? to : [to]).filter(Boolean)
    const ccList: string[] = (Array.isArray(cc) ? cc : (cc ? [cc] : [])).filter(Boolean)
    const bccList: string[] = (Array.isArray(bcc) ? bcc : (bcc ? [bcc] : [])).filter(Boolean)
    const allRecipients = [...toList, ...ccList, ...bccList]
    if(allRecipients.length === 0){
      return res.status(400).json({ ok: false, error: 'No recipients provided for fallback' })
    }
    const headers: Record<string,string> = { 'Content-Type': 'application/json', 'User-Agent': 'ElectrixCRM/Server (+https://electrixspace.com)' }
    const token = process.env.EMAIL_TOKEN || process.env.CONTACT_TOKEN || ''
    if(token) headers['X-CRM-Token'] = token
    const message = `Subject: ${subject}\n\n${text || ''}`
    let sent = 0
    let failed: Array<{ rcpt: string; error: string }> = []
    for(const rcpt of allRecipients){
      const payload = { name: from || 'ELECTRIX CRM', email: rcpt, message, website: '', contact_time: new Date().toISOString() }
      try{
        const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) as any })
        if(resp.ok){ sent++ } else {
          const txt = await resp.text().catch(()=>String(resp.status))
          failed.push({ rcpt, error: txt })
        }
      }catch(err:any){
        failed.push({ rcpt, error: err?.message || 'network error' })
      }
    }
    if(sent > 0 && failed.length === 0){
      return res.json({ ok: true, via: 'fallback', sent })
    }
    if(sent > 0 && failed.length > 0){
      return res.status(207).json({ ok: true, via: 'fallback', sent, failed })
    }
    const firstErr = failed[0]?.error || 'unknown error'
    console.warn('[Email][Fallback] All sends failed:', failed)
    return res.status(502).json({ ok: false, error: 'Fallback email failed: ' + firstErr, failed })
  } catch (e: any) {
    console.warn('[Email][Fallback] Error:', e?.message || e)
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to send email (fallback)' })
  }
})

export default router
