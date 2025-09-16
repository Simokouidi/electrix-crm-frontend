import { chromium } from 'playwright'
import http from 'http'

;(async()=>{
  const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173'
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const logs: any[] = []
  page.on('console', msg => logs.push({ type: 'console', text: msg.text() }))
  page.on('requestfailed', req => logs.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText }))
  page.on('response', async resp => {
    try{ const body = await resp.text(); logs.push({ type: 'response', url: resp.url(), status: resp.status(), body: body.slice(0,2000) }) }catch(e){}
  })

  await page.goto(appUrl)
  await page.waitForTimeout(1000)

  // invoke the in-page test helper if present
  const hasHelper = await page.evaluate(() => !!(window as any).__CRM_TEST_NOTIFY)
  logs.push({ type: 'info', hasHelper })
  if(!hasHelper){
    console.log('No in-page test helper found')
    console.log(JSON.stringify(logs, null, 2))
    await browser.close()
    process.exit(2)
  }

  // call notifyStatusChange for activity a-1
  try{
    const res = await page.evaluate(() => (window as any).__CRM_TEST_NOTIFY.notifyStatusChange('a-1', 'Automated test note'))
    logs.push({ type: 'invokeResult', res })
  }catch(e:any){
    logs.push({ type: 'invokeError', error: String(e) })
  }

  console.log('LOGS:')
  console.log(JSON.stringify(logs, null, 2))
  await browser.close()
})().catch(e=>{ console.error(e); process.exit(1) })
