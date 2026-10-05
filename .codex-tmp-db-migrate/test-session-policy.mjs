import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const token=expired=>`e30.${Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+(expired?-10:900)})).toString('base64url')}.signature`;
try {
 for(const actor of ['customer','assistant','admin']) {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const admin=actor==='admin';let refreshes=0,status=200,delay=0,sessionStatus=204;
  const refreshPath=admin?'/auth/refresh':`/portal/${actor}/session/refresh`;
  const sessionPath=admin?'/auth/session':`/portal/${actor}/session`;
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.route(`**${refreshPath}`,async route=>{
    refreshes++;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    await route.fulfill({status,json:status===200?{data:{token:token(false),refreshToken:'renewed-refresh',user:{id:'u',displayName:'Test'},roles:[{code:'admin'}]}}:{error:{message:'Account is not active.'}}});
  });
  await page.route(`**${sessionPath}`,route=>sessionStatus===204?route.fulfill({status:204,body:''}):route.fulfill({status:sessionStatus,json:{error:{message:'Account is not active.'}}}));
  await page.goto(`http://localhost:4003/${admin?'admin/':actor}`,{waitUntil:'domcontentloaded'});
  const seed=async expired=>page.evaluate(({value,admin})=>{
    state.token=value;state.refreshToken='saved-refresh';state.user={id:'u',displayName:'Test'};
    if(admin){cache.assistantMasters=[{id:'private-record'}];localStorage.setItem('zigoAdminToken',value);localStorage.setItem('zigoAdminRefreshToken','saved-refresh');localStorage.setItem('zigoAdminUser',JSON.stringify(state.user));}
    else {state.connectionLost=false;state.splashDone=true;localStorage.setItem(tokenKey,value);localStorage.setItem(refreshTokenKey,'saved-refresh');localStorage.setItem(sessionCacheKey,JSON.stringify({privateData:true}));portalResourceCache.set('/private',{data:'secret'});}
  },{value:token(expired),admin});
  const check=()=>page.evaluate(async admin=>{await(admin?checkAdminSession():checkPortalSession());},admin);
  await seed(false);await check();assert.equal(refreshes,0);assert.ok(await page.evaluate(()=>state.token));
  await seed(true);delay=100;await page.evaluate(async admin=>{await Promise.all(Array.from({length:5},()=>admin?checkAdminSession():checkPortalSession()));},admin);
  assert.equal(refreshes,1);assert.ok(await page.evaluate(()=>state.token));delay=0;
  await seed(true);status=503;await check();assert.equal(await page.evaluate(()=>state.refreshToken),'saved-refresh');
  await seed(true);status=401;await check();assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false);
  if(admin)assert.equal(await page.evaluate(()=>cache.assistantMasters.length),0);
  else {assert.equal(await page.evaluate(()=>localStorage.getItem(sessionCacheKey)),null);assert.equal(await page.evaluate(()=>portalResourceCache.size),0);}
  await seed(false);status=200;sessionStatus=401;await check();assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false);sessionStatus=204;
  await seed(true);delay=300;
  await page.evaluate(async admin=>{
    const pending=admin?refreshAdminSession().catch(()=>{}):refreshPortalAccessToken();
    if(admin)clearAdminSession();else clearPortalSession();await pending;
  },admin);assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false);delay=0;
  await seed(false);
  await page.evaluate(admin=>window.dispatchEvent(new StorageEvent('storage',{key:admin?'zigoAdminToken':tokenKey,newValue:null})),admin);
  assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false);
  await seed(false);
  await page.evaluate(admin=>{
    if(admin)handleBookingRealtimeEvent({type:'user.session.revoked',payload:{userId:'u'}});
    else {
      window.EventSource=class {constructor(){this.handlers={};}addEventListener(name,handler){this.handlers[name]=handler;}close(){}};
      if(actor==='assistant') {
        startAssistantRealtime(true);
        assistantRealtimeSource.handlers.assistant_task_changed({data:JSON.stringify({type:'user.session.revoked',payload:{userId:'u'}})});
      } else {
        startCustomerRealtime(true);
        customerRealtimeSource.handlers.customer_session_revoked({data:JSON.stringify({status:401,message:'Account access ended.'})});
      }
    }
  },admin);
  assert.equal(await page.evaluate(()=>Boolean(state.token||state.refreshToken)),false,'Realtime revocation must log out immediately');
  console.log(`${actor}: valid session retained, one concurrent automatic refresh, transient failure preserved, revocation clears caches, late refresh cannot resurrect logout, cross-tab logout passed.`);
  await page.close();
 }
}finally{await browser.close();}
