import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const actor of ['customer','assistant']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.route(`**/portal/${actor}/code/*`,route=>route.fulfill({status:403,json:{error:{message:'Account is deactive or deleted. Contact admin.'}}}));
  await page.goto(`http://localhost:4003/${actor}`,{waitUntil:'domcontentloaded'});
  for(const action of ['send','verify']) {
   await page.evaluate(async({actor,action})=>{
    state.splashDone=true;state.codeSent=action==='verify';state.loginPhone='9876543210';state.otpResendAvailableAt=0;render();
    const form=document.getElementById(`${actor}LoginForm`);
    form.querySelector('[name="phone"]').value='9876543210';
    const code=form.querySelector('[name="code"]');if(code)code.value='123456';
    await handleLoginSubmit({preventDefault(){},target:form,submitter:{dataset:{loginAction:action}}});
   },{actor,action});
   const popup=page.locator('[data-login-unavailable-dialog]');await popup.waitFor({state:'visible'});
   assert.ok((await popup.innerText()).includes('Please contact support'));
   assert.ok(!(await popup.innerText()).includes('deactive'));
   assert.ok(!(await popup.innerText()).includes('deleted'));
   assert.equal(await page.evaluate(()=>Boolean(state.token)),false);
   assert.equal(await page.locator('[data-connection-lost-overlay]').count(),0);
   await page.screenshot({path:`.codex-tmp-db-migrate/login-unavailable-${actor}-${action}.png`});
   await popup.locator('button').click();await popup.waitFor({state:'detached'});
  }
  await page.evaluate(()=>showPortalLoginError({status:404,message:'Account not found'}));
  await page.keyboard.press('Escape');await page.locator('[data-login-unavailable-dialog]').waitFor({state:'detached'});
  await page.evaluate(()=>showPortalLoginError({status:400,message:'Invalid verification code'}));
  assert.equal(await page.locator('[data-login-unavailable-dialog]').count(),0);
  console.log(`${actor}: OTP send/verify blocked-account popup, generic text, dismissal, no login/offline overlay, and normal validation errors passed.`);
  await page.close();
 }
}finally{await browser.close();}
