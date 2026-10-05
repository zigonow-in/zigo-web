import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
const polygon='POLYGON ((77.205 28.625,77.213 28.625,77.213 28.633,77.205 28.633,77.205 28.625))';
try {
  for (const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const types=[{id:'t1',name:'Residential',color:'#ff0000',isActive:true},{id:'t2',name:'Commercial',color:'#0000ff',isActive:true},{id:'t3',name:'Legacy',color:'#dc2626',isActive:false}];
    let rows=[{id:'n1',parentId:'m1',name:'Nano One',code:'N1',polygonDescription:polygon,isOpen:true,marketTypeIds:['t3'],marketTypes:[types[2]],polygonColor:'#dc2626'}];
    let saved;
    await page.route('**/masters/market-types',r=>r.fulfill({json:{data:types}}));
    await page.route('**/masters/location-hierarchy/micro-markets',r=>r.fulfill({json:{data:[{id:'m1',name:'Micro One',polygonDescription:polygon}]}}));
    await page.route('**/masters/location-hierarchy/nano-markets**',r=>{
      if(r.request().method()==='PUT') {saved=r.request().postDataJSON();rows=[{id:'n1',...saved,marketTypes:saved.marketTypeIds.map(id=>types.find(t=>t.id===id)),polygonColor:'#ff0000'}];}
      return r.fulfill({json:{data:r.request().method()==='GET'?rows:{id:'n1'}}});
    });
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');document.querySelector('#adminView').classList.remove('d-none');
      state.section='nanoMarkets';document.querySelector('#nanoMarketsSection').classList.remove('d-none');await loadLocationHierarchyPage('nanoMarkets');
    });
    const root=page.locator('#nanoMarketsSection');
    assert.equal(await root.locator('[name="marketTypeIds"]').count(),2);
    await root.locator('[data-location-command="edit"]').click();
    await root.locator('[data-market-types] summary').click();
    assert.equal(await root.locator('[name="marketTypeIds"][value="t3"]').isChecked(),true);
    await root.locator('[name="marketTypeIds"][value="t3"]').uncheck();
    await root.locator('[name="marketTypeIds"][value="t1"]').check();
    await root.locator('[name="marketTypeIds"][value="t2"]').check();
    assert.equal(await root.locator('[data-market-type-summary] .market-type-selected').count(),2);
    assert.deepEqual(await root.locator('[data-market-type-summary] .market-type-color').evaluateAll(nodes=>nodes.map(node=>node.style.backgroundColor)),['rgb(255, 0, 0)','rgb(0, 0, 255)']);
    await page.waitForFunction(()=>locationMapEditor.map.getSource('editor-market-sections')._data.features.length===2);
    assert.deepEqual(await page.evaluate(()=>locationMapEditor.map.getSource('editor-market-sections')._data.features.map(f=>f.properties.color)),['#ff0000','#0000ff']);
    assert.equal((await root.locator('[name="polygonDescription"]').inputValue()).replaceAll(/\s/g,''),polygon.replaceAll(/\s/g,''));
    await page.screenshot({path:`.codex-tmp-db-migrate/nano-market-checkboxes-${width}.png`,fullPage:true});
    await root.locator('[data-market-types] summary').click();
    await root.locator('[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#nanoMarketsSection [name="id"]').value==='');
    await page.waitForFunction(()=>locationMapEditor?.draw);
    assert.deepEqual(saved.marketTypeIds.slice().sort(),['t1','t2']);
    await root.locator('[data-location-command="edit"]').click();
    assert.equal(await root.locator('[name="marketTypeIds"]:checked').count(),2);
    await page.screenshot({path:`.codex-tmp-db-migrate/nano-market-type-${width}.png`,fullPage:true});
    await root.locator('[type="reset"]').click();await page.waitForTimeout(100);
    assert.equal(await root.locator('[name="marketTypeIds"]:checked').count(),0);assert.equal(await root.locator('[data-market-type-summary] .market-type-selected').count(),0);
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.evaluate(()=>locationMapEditor.destroy());await page.close();console.log(width,'Checkbox dropdown, individual colour swatches, separate polygon sections, save/edit and reset passed');
  }
} finally {await browser.close();}
