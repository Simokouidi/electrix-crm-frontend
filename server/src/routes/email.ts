import { Router } from 'express'
import { sendMail } from '../services/mailer'

const router = Router()

router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html, cc, bcc, from } = req.body || {}
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: to, subject, and one of text or html' })
    }
    const info = await sendMail({ to, subject, text, html, cc, bcc, from })
    res.json({ ok: true, messageId: info.messageId })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to send email' })
  }
})

export default router
