import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/location-hierarchy/micro-markets',route=>route.fulfill({json:{data:[{id:'m',parentId:'c',name:'Micro One'}]}}));
    await page.route('**/masters/location-hierarchy/nano-markets',route=>route.fulfill({json:{data:[{id:'n',parentId:'m',name:'Nano One'}]}}));
    await page.goto((process.argv[2]||'http://127.0.0.1:4011')+'/admin/');
    await page.evaluate(()=>{
      cache.states=[{id:'s',name:'State',isActive:true}];cache.cities=[{id:'city',stateId:'s',name:'City',isActive:true}];
      cache.zones=[{id:'z',cityId:'city',name:'Zone',isActive:true}];cache.clusters=[{id:'c',cityId:'city',zoneId:'z',name:'Cluster One',isActive:true}];
      cache.assistantAreaMicroMarkets=[{id:'m',name:'Micro One'}];cache.assistantAreaNanoMarkets=[{id:'n',name:'Nano One'}];
      const area={stateId:'s',cityId:'city',zoneId:'z',clusters:['c'],microMarkets:['m'],nanoMarkets:['n'],allClusters:true,allMicroMarkets:true,allNanoMarkets:true};
      cache.assistantMasters=[{id:'a',cityId:'city',displayName:'Assigned Assistant',phone:'9876543210',documents:[],areaAssignments:{working:area,assign:{...area,allClusters:false,allMicroMarkets:false,allNanoMarkets:false}}}];
      document.getElementById('loginView').classList.add('d-none');document.getElementById('adminView').classList.remove('d-none');
      document.getElementById('assistantSection').classList.remove('d-none');
      document.getElementById('assistantSection').innerHTML=assistantCards(cache.assistantMasters);
    });
    const working=page.locator('[data-area-listing-tab="working"]');
    const assign=page.locator('[data-area-listing-tab="assign"]');
    assert.ok((await working.innerText()).includes('All (1): Cluster One'));
    assert.ok((await assign.innerText()).includes('Nano One'));
    assert.equal(await page.locator('.assistant-report-head span').count(),7);
    await assign.click();
    assert.equal(await page.locator('[data-area-tab="assign"]').getAttribute('aria-selected'),'true');
    await page.waitForFunction(()=>assistantAreaEditor?.assign.nanoMarkets.includes('n'));
    await page.locator('[data-action="close-assistant-master-edit"]').click().catch(async()=>{await page.evaluate(()=>document.getElementById('assistantMasterEditModal').classList.add('d-none'));});
    await page.screenshot({path:`.codex-tmp-db-migrate/assistant-area-listing-${width}.png`});
    assert.deepEqual(errors,[]);
    console.log(`Assistant listing ${width}: two columns, names, All selections and matching edit tab passed.`);
    await page.close();
  }
} finally {await browser.close();}
