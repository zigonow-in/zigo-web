import assert from 'node:assert/strict';
import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1280,390]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/location-hierarchy/micro-markets',route=>route.fulfill({json:{data:[{id:'m1',parentId:'c1',name:'Micro One'},{id:'m2',parentId:'c2',name:'Micro Two'}]}}));
    await page.route('**/masters/location-hierarchy/nano-markets',route=>route.fulfill({json:{data:[{id:'n1',parentId:'m1',name:'Nano One'},{id:'n2',parentId:'m2',name:'Nano Two'}]}}));
    await page.goto((process.argv[2]||'http://127.0.0.1:4010')+'/admin/');
    await page.evaluate(()=>{
      cache.states=[{id:'s',name:'State',isActive:true}];cache.cities=[{id:'city',stateId:'s',name:'City',isActive:true}];
      cache.zones=[{id:'z',cityId:'city',name:'Zone',isActive:true}];
      cache.clusters=[{id:'c1',cityId:'city',zoneId:'z',name:'Cluster One',isActive:true},{id:'c2',cityId:'city',zoneId:'z',name:'Cluster Two',isActive:true}];
      cache.assistantMasters=[{id:'a',cityId:'city',displayName:'Test Assistant',clusters:[]}];openAssistantMasterEditModal('a','cluster');
    });
    await page.locator('[data-form="assistant-master-cluster"] button[type="submit"]').waitFor();
    await page.waitForFunction(()=>assistantAreaEditor?.working.nanoMarkets.length===2);
    assert.equal(await page.locator('[data-area-list="working-clusters"] summary').innerText(),'Cluster: All');
    await page.locator('[data-area-list="working-clusters"] summary').click();
    await page.locator('[data-area-scope="working"][value="c2"]').uncheck();
    assert.deepEqual(await page.evaluate(()=>assistantAreaEditor.working.clusters),['c1']);
    await page.locator('[data-area-tab="assign"]').click();
    assert.equal(await page.locator('[data-area-panel="assign"] h3').innerText(),'Assign Area');
    assert.equal(await page.locator('[data-area-scope="assign"][value="c2"]').count(),0);
    assert.equal(await page.locator('[data-area-scope="assign"][value="m2"]').count(),0);
    assert.equal(await page.locator('[data-area-scope="assign"][value="n2"]').count(),0);
    assert.deepEqual(await page.evaluate(()=>assistantAreaEditor.assign.nanoMarkets),['n1']);
    await page.screenshot({path:`.codex-tmp-db-migrate/assistant-areas-${width}.png`});
    await page.locator('[data-area-tab="working"]').click();
    await page.locator('[data-area-list="working-clusters"] summary').click();
    await page.locator('[data-area-scope="working"][data-area-level="clusters"][value="all"]').check();
    assert.deepEqual(await page.evaluate(()=>assistantAreaEditor.assign.clusters),['c1','c2']);
    await page.evaluate(()=>{
      cache.assistantMasters[0].areaAssignments=JSON.parse(JSON.stringify({working:assistantAreaEditor.working,assign:assistantAreaEditor.assign}));
      cache.assistantMasters[0].areaAssignments.working.allClusters=false;
      cache.assistantMasters[0].areaAssignments.working.clusters=['c2'];
      openAssistantMasterEditModal('a','cluster');
    });
    await page.waitForFunction(()=>assistantAreaEditor?.working.clusters.length===1 && assistantAreaEditor.working.clusters[0]==='c2');
    assert.deepEqual(await page.evaluate(()=>assistantAreaEditor.assign.nanoMarkets),['n2']);
    assert.deepEqual(errors,[]);
    console.log(`Assistant areas ${width}: defaults, tabs, parent restrictions, multi-selection and restored selections passed.`);
    await page.close();
  }
} finally {await browser.close();}
