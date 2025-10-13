import nodemailer from 'nodemailer'

export type MailParams = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
}

let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (cachedTransporter) return cachedTransporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || (port === 465)

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optional SMTP_SECURE)')
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
  return cachedTransporter
}

export async function sendMail({ to, subject, html, text, cc, bcc, from }: MailParams) {
  const transporter = getTransporter()
  const fromAddr = from || process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com'

  const info = await transporter.sendMail({
    from: fromAddr,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
  })
  return info
}
