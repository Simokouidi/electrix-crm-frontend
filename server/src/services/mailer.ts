import nodemailer from 'nodemailer'

export type MailAddress = string | string[]
export interface MailOptions {
  to: MailAddress
  cc?: MailAddress
  bcc?: MailAddress
  subject: string
  text?: string
  html?: string
  replyTo?: string
  from?: string
}

let transporter: nodemailer.Transporter | null = null

function ensureTransporter(): nodemailer.Transporter {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  if (!host || !user || !pass) throw new Error('SMTP not configured')
  transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  return transporter
}

function normalize(v?: MailAddress): string[] | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) return v.filter(Boolean)
  return String(v).split(',').map(s => s.trim()).filter(Boolean)
}

export async function sendMail(opts: MailOptions) {
  const tx = ensureTransporter()
  const from = opts.from || process.env.FROM_EMAIL || process.env.SMTP_USER || ''
  const to = normalize(opts.to)
  const cc = normalize(opts.cc)
  const bcc = normalize(opts.bcc)
  if (!to || to.length === 0) throw new Error('Missing recipient')
  const info = await tx.sendMail({ from, to, cc, bcc, subject: opts.subject, text: opts.text, html: opts.html, replyTo: opts.replyTo })
  return info
}
