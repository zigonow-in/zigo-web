import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const actor of ['customer','assistant']) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route(`**/portal/${actor}/session/refresh`,route=>route.fulfill({status:401,json:{error:{message:'Account is not active. Please contact admin.'}}}));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(`http://localhost:4003/${actor}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(2200);
  await page.evaluate(async()=>{
    state.token='';state.refreshToken='invalid-saved-refresh-token';state.connectionLost=true;
    renderConnectionLostPage();await restoreAfterConnection();
  });
  assert.equal(await page.locator('[data-connection-lost-overlay]').count(),0,`${actor}: rejected refresh must return to login, not offline`);
  assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false);
  await page.evaluate(()=>{state.token='temporary-token';state.refreshToken='temporary-refresh';state.connectionLost=true;renderConnectionLostPage();forcePortalSessionLogout('Account is not active.');});
  assert.equal(await page.locator('[data-connection-lost-overlay]').count(),0,`${actor}: logout removes stale offline overlay`);
  await context.setOffline(true);
  await page.evaluate(()=>{state.connectionLost=true;renderConnectionLostPage();});
  assert.equal(await page.locator('[data-connection-lost-overlay]').count(),1);
  await context.setOffline(false);
  await page.evaluate(async()=>{await restoreAfterConnection();});
  assert.equal(await page.locator('[data-connection-lost-overlay]').count(),0,`${actor}: real offline recovery works`);
  console.log(`${actor}: rejected saved session, logout overlay cleanup, and real offline recovery passed.`);
  await context.close();
 }
}finally{await browser.close();}
