import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
const polygon = (x) => `POLYGON ((${x} 28.625,${x+.008} 28.625,${x+.008} 28.633,${x} 28.633,${x} 28.625))`;
try {
  for (const width of [1280,390]) {
    for (const section of ['zones','clusters','nanoMarkets']) {
      const page = await browser.newPage({viewport:{width,height:950}});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/masters/**',route=>route.fulfill({json:{data:[]}}));
      await page.goto(`${process.argv[2]}/admin/`);
      await page.evaluate(async section=>{
        document.querySelector('#loginView').classList.add('d-none');
        document.querySelector('#adminView').classList.remove('d-none');
        state.section=section;
        document.querySelector(`#${section}Section`).classList.remove('d-none');
      },section);
      const endpoints = await page.evaluate(section=>locationHierarchyPages[section],section);
      const records = [{id:'a',parentId:'p1',name:'Area One',code:'A1',polygonDescription:polygon(77.205)}, {id:'b',parentId:'p2',name:'Area Two',code:'A2',polygonDescription:polygon(77.225)}];
      await page.route(`**/masters/location-hierarchy/${endpoints.endpoint}`,r=>r.fulfill({json:{data:records}}));
      await page.route(`**${endpoints.parentEndpoint}`,r=>r.fulfill({json:{data:[{id:'p1',name:'Parent One'},{id:'p2',name:'Parent Two'}]}}));
      await page.evaluate(section=>loadLocationHierarchyPage(section),section);
      const form=page.locator(`#${section}Section [data-location-hierarchy-form]`);
      await form.locator('[name="parentId"]').selectOption('p1');
      await page.waitForFunction(()=>locationMapEditor.map.getSource('editor-name-labels')._data.features.length===1);
      assert.equal(await page.evaluate(()=>locationMapEditor.map.getSource('editor-name-labels')._data.features[0].properties.name),'Area One');
      await page.locator(`#${section}Section [data-location-command="edit"][data-id="a"]`).evaluate(el=>el.click());
      await form.locator('[name="name"]').fill('Updated Name');
      await page.waitForFunction(()=>locationMapEditor.map.getSource('editor-name-labels')._data.features.some(f=>f.properties.name==='Updated Name'));
      assert.deepEqual(await page.evaluate(()=>locationMapEditor.map.getLayoutProperty('editor-reference-label','text-font')),['Gentona Bold']);
      const colors={zones:'#005df2',clusters:'#16a34a',nanoMarkets:'#dc2626'};
      assert.equal(await page.evaluate(()=>locationMapEditor.map.getPaintProperty('editor-reference-fill','fill-color')),colors[section]);
      await page.waitForTimeout(700);
      await page.screenshot({path:`.codex-tmp-db-migrate/${section}-labels-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      await page.evaluate(()=>locationMapEditor.destroy()); await page.close();
      console.log(section,width,'filtering, bold name strips, rename and colour passed');
    }
  }
} finally {await browser.close();}
