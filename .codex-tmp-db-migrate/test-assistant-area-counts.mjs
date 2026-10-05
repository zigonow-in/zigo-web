import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/location-hierarchy/micro-markets',route=>route.fulfill({json:{data:[{id:'m',parentId:'c',name:'Micro One'}]}}));
    await page.route('**/masters/location-hierarchy/nano-markets',route=>route.fulfill({json:{data:[{id:'n',parentId:'m',name:'Nano One'}]}}));
    await page.goto((process.argv[2]||'http://127.0.0.1:4011')+'/admin/');
    await page.evaluate(()=>{
      cache.states=[{id:'s',name:'State',isActive:true}];cache.cities=[{id:'city',stateId:'s',name:'City',isActive:true}];
      cache.zones=[{id:'z',cityId:'city',name:'Zone',isActive:true}];cache.clusters=[{id:'c',cityId:'city',zoneId:'z',name:'Cluster One',isActive:true}];
      const area={stateId:'s',cityId:'city',zoneId:'z',clusters:['c'],microMarkets:['m'],nanoMarkets:['n'],allClusters:true,allMicroMarkets:true,allNanoMarkets:true};
      cache.assistantMasters=[{id:'a',cityId:'city',displayName:'Editing Assistant',clusters:[]},{id:'b',displayName:'Assigned One',phone:'9876543210',profilePictureUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',areaAssignments:{working:area,assign:area}},{id:'d',displayName:'Working Only',phone:'9876543211',areaAssignments:{working:area,assign:{...area,clusters:[],microMarkets:[],nanoMarkets:[]}}},{id:'legacy',displayName:'Legacy Assistant',phone:'9876543212',currentClusterId:'c',clusters:[{clusterId:'c',isActive:true},{clusterId:'c',isActive:true}]}];
      openAssistantMasterEditModal('a','cluster');
    });
    await page.waitForFunction(()=>assistantAreaEditor?.assignments);
    for(const [level,count] of [['clusters',3],['microMarkets',2],['nanoMarkets',2]]) {
      await page.locator(`[data-area-list="working-${level}"] summary`).click();
      const button=page.locator(`[data-area-assigned="working"][data-area-level="${level}"][data-area-id="${level==='clusters'?'c':level==='microMarkets'?'m':'n'}"]`);
      assert.equal(await button.innerText(),`[${count}] Assigned`);
      if(width===1280) await button.hover(); else await button.click();
      const popup=page.locator('#assistantAreaAssignedPopover');await popup.waitFor({state:'visible'});
      assert.equal(await popup.locator('.assistant-area-assigned-person').count(),count);
      assert.ok((await popup.innerText()).includes('9876543210'));
      if(width===1280) {await popup.hover();await page.waitForTimeout(250);assert.equal(await popup.isVisible(),true);}
      const bounds=await popup.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
      await page.keyboard.press('Escape');assert.equal(await popup.isVisible(),false);
    }
    await page.locator('[data-area-tab="assign"]').click();
    await page.locator('[data-area-list="assign-nanoMarkets"] summary').click();
    const assignedButton=page.locator('[data-area-assigned="assign"][data-area-level="nanoMarkets"][data-area-id="n"]');
    assert.equal(await assignedButton.innerText(),'[1] Assigned');await assignedButton.click();
    await page.screenshot({path:`.codex-tmp-db-migrate/assistant-area-counts-${width}.png`});
    assert.equal(await page.locator('#assistantAreaAssignedPopover .assistant-area-assigned-person').count(),1);
    await page.locator('#assistantMasterEditModalTitle').click();assert.equal(await page.locator('#assistantAreaAssignedPopover').isVisible(),false);
    assert.deepEqual(errors,[]);console.log(`Assignment counts ${width}: scope-specific counts, deduplication, hover/touch popup, details and dismissal passed.`);
    await page.close();
  }
} finally {await browser.close();}
