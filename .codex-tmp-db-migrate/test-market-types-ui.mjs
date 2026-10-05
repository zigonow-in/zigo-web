import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
    let records=[{id:'b',name:'Zebra',code:'ZZ',description:'Second market',color:'#dc2626',isActive:false},{id:'a',name:'Alpha',code:'AA',description:'First market',color:'#16a34a',isActive:true}];
    let mutations=0;
    await page.route('**/masters/market-types**',async route=>{
      const req=route.request(), method=req.method();
      if(method==='POST') {mutations++; records.push({id:'c',...req.postDataJSON()});}
      if(method==='PUT') {mutations++; records=records.map(r=>r.id==='c'?{id:'c',...req.postDataJSON()}:r);}
      if(method==='DELETE') {mutations++; records=records.filter(r=>r.id!=='c');}
      await route.fulfill({status:method==='POST'?201:200,json:{data:method==='GET'?records:{id:'c'}}});
    });
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');
      document.querySelector('#adminView').classList.remove('d-none');
      state.section='marketTypes'; document.querySelector('#marketTypesSection').classList.remove('d-none');
      await loadMarketTypes();
    });
    const root=page.locator('#marketTypesSection');
    assert.equal(await root.locator('tbody tr').first().locator('td').first().textContent(),'Alpha');
    await root.locator('[name="name"]').fill('Beta'); await root.locator('[name="code"]').fill('BB');
    await root.locator('[name="description"]').fill('Created market'); await root.locator('[name="color"]').fill('#f97316');
    await root.locator('[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-market-type-command="edit"][data-id="c"]'));
    await root.locator('[data-market-type-command="edit"][data-id="c"]').click();
    assert.equal(await root.locator('[name="color"]').inputValue(),'#f97316');
    await root.locator('[name="name"]').fill('Beta Updated'); await root.locator('[name="isActive"]').uncheck();
    await root.locator('[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#marketTypesSection').textContent.includes('Beta Updated'));
    await page.screenshot({path:`.codex-tmp-db-migrate/market-types-${width}.png`,fullPage:true});
    await root.locator('[data-market-type-command="delete"][data-id="c"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-market-type-command="edit"][data-id="c"]'));
    assert.equal(mutations,3,'One request per create/update/delete even after reloading');
    assert.deepEqual(errors,[]); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.close(); console.log(width,'Market Type sorting, colour picker, create/edit/delete and layout passed');
  }
} finally {await browser.close();}
