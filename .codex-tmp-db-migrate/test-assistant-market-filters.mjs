import assert from 'node:assert/strict';
import {chromium} from './browser-tests/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const city={id:'city',stateId:'s',name:'City',isActive:true};
    const cluster=id=>({id,cityId:'city',zoneId:'z',name:id==='c1'?'Cluster One':'Cluster Two',isActive:true});
    const area=(c,m,n)=>({clusters:[c],microMarkets:[m],nanoMarkets:[n]});
    const data={
      '/assistant-master':[{id:'a1',displayName:'Assistant One',cityId:'city',zoneId:'z',areaAssignments:{working:area('c1','m1','n1')}},{id:'a2',displayName:'Assistant Two',cityId:'city',zoneId:'z',areaAssignments:{working:area('c2','m2','n2')}}],
      '/masters/cities':[city],'/masters/zones':[{id:'z',cityId:'city',name:'Zone',isActive:true}],'/masters/clusters':[cluster('c1'),cluster('c2')],'/masters/states':[{id:'s',name:'State',isActive:true}],
      '/masters/location-hierarchy/micro-markets':[{id:'m1',parentId:'c1',name:'Micro One'},{id:'m2',parentId:'c2',name:'Micro Two'}],
      '/masters/location-hierarchy/nano-markets':[{id:'n1',parentId:'m1',name:'Nano One'},{id:'n2',parentId:'m2',name:'Nano Two'}],'/verification/document-types':[], '/vehicle-master':[]
    };
    for(const [path,records] of Object.entries(data)) await page.route(`**${path}`,route=>route.fulfill({json:{data:records}}));
    await page.goto((process.argv[2]||'http://127.0.0.1:4011')+'/admin/');
    await page.evaluate(async()=>{document.getElementById('loginView').classList.add('d-none');document.getElementById('adminView').classList.remove('d-none');document.getElementById('assistantSection').classList.remove('d-none');await loadAssistant();});
    assert.equal(await page.locator('#assistantMicroMarketFilter option').count(),3);
    assert.equal(await page.locator('#assistantNanoMarketFilter option').count(),3);
    assert.deepEqual(await page.evaluate(()=>Array.from(document.querySelector('.assistant-page .assistant-filter-row').children).map(item=>item.id||item.textContent.trim()).slice(-4)),['assistantClusterFilter','assistantMicroMarketFilter','assistantNanoMarketFilter','Search']);
    await page.locator('#assistantClusterFilter').selectOption('c1');
    assert.equal(await page.locator('#assistantMicroMarketFilter option').count(),2);
    assert.equal(await page.locator('#assistantNanoMarketFilter option').count(),2);
    await page.locator('#assistantMicroMarketFilter').selectOption('m1');
    await page.locator('#assistantNanoMarketFilter').selectOption('n1');
    assert.deepEqual(await page.evaluate(()=>cache.assistantMasters.filter(assistantBaseMatchesFilters).map(item=>item.id)),['a1']);
    await page.locator('#assistantClusterFilter').selectOption('c2');
    assert.equal(await page.locator('#assistantMicroMarketFilter').inputValue(),'');
    assert.equal(await page.locator('#assistantNanoMarketFilter').inputValue(),'');
    assert.deepEqual(await page.evaluate(()=>cache.assistantMasters.filter(assistantBaseMatchesFilters).map(item=>item.id)),['a2']);
    await page.locator('#assistantClusterFilter').selectOption('');
    await page.locator('#assistantMicroMarketFilter').selectOption('m1');
    assert.deepEqual(await page.evaluate(()=>cache.assistantMasters.filter(assistantBaseMatchesFilters).map(item=>item.id)),['a1']);
    const bounds=await page.locator('.assistant-page .assistant-filter-row').boundingBox();
    assert.ok(bounds.x+bounds.width<=width+1);
    await page.screenshot({path:`.codex-tmp-db-migrate/assistant-market-filters-${width}.png`});
    await page.evaluate(()=>clearInterval(assistantOnlineTimer));
    assert.deepEqual(errors,[]);console.log(`Assistant market filters ${width}: control order, cascades, membership matching, reset and responsive fit passed.`);
    await page.close();
  }
} finally {await browser.close();}
