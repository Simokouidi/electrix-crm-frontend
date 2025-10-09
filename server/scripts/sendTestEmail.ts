import { sendMail } from '../src/services/mailer'

async function main(){
  const to = process.env.TEST_TO || process.env.ALLOWED_ORIGIN || ''
  if(!to){
    console.error('Set TEST_TO to the recipient email (e.g., TEST_TO=careforce@electrixspace.com)')
    process.exit(1)
  }
  const subject = 'Test email from Electrix CRM server'
  const text = 'This is a test email sent from a Heroku one-off dyno using nodemailer.'
  const info = await sendMail({ to, subject, text })
  console.log('Sent messageId:', info.messageId)
}

main().catch(err => { console.error(err); process.exit(1) })
