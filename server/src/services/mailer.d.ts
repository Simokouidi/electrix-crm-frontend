export interface MailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  from?: string
}

export function sendMail(opts: MailOptions): Promise<any>
export function isSmtpConfigured(): boolean
export function smtpConfigSummary(): { host: string | null; port: number; secure: boolean; userSet: boolean; from: string | null; configured: boolean }

export {}
