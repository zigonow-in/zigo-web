import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const actor of ['customer','assistant']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];const failures=[];page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>failures.push({url:request.url(),error:request.failure()?.errorText}));
  await page.goto(`http://localhost:4003/${actor}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(3500);
  console.log(JSON.stringify({actor,url:page.url(),online:await page.evaluate(()=>navigator.onLine),offlineOverlay:await page.locator('[data-connection-lost-overlay]').count(),text:(await page.locator('body').innerText()).slice(0,500),errors,failures}));
  await page.screenshot({path:`.codex-tmp-db-migrate/portal-opening-${actor}.png`});await page.close();
 }
}finally{await browser.close();}
