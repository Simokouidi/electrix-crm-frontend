const { chromium } = require('playwright');
(async ()=>{
  const url = 'http://127.0.0.1:5173';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try{
    await page.goto(url, { waitUntil: 'load', timeout: 10000 });
    console.log('Loaded', url);
    const has = await page.evaluate(() => !!(window.__CRM_TEST_NOTIFY));
    console.log('has helper =', has);
  }catch(e){
    console.error('ERR', e);
    process.exit(2);
  } finally{
    await browser.close();
  }
})();
