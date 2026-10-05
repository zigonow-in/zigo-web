import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const polygon='POLYGON ((77.205 28.625,77.213 28.625,77.213 28.633,77.205 28.633,77.205 28.625))';
try {
  for(const width of [1280,390]) for(const section of ['zones','clusters','microMarkets','nanoMarkets']) {
    const page=await browser.newPage({viewport:{width,height:950}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/masters/**',r=>r.fulfill({json:{data:[]}}));
    await page.route('**/maps/style.json',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.continue();});
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(section=>{
      document.querySelector('#loginView').classList.add('d-none');document.querySelector('#adminView').classList.remove('d-none');
      state.section=section;document.querySelector(`#${section}Section`).classList.remove('d-none');
      window.loadingPagePromise=loadLocationHierarchyPage(section);
    },section);
    const spinner=page.locator(`#${section}Section [data-map-loading]`);
    await spinner.waitFor({state:'visible'});
    const centered=await page.locator(`#${section}Section .map-loading-spinner`).evaluate(el=>{
      const a=el.getBoundingClientRect(),b=el.closest('.location-map-surface').getBoundingClientRect();
      return Math.abs(a.x+a.width/2-b.x-b.width/2)<1 && Math.abs(a.y+a.height/2-b.y-b.height/2)<1;
    });
    assert.equal(centered,true);
    await page.evaluate(()=>window.loadingPagePromise);
    await spinner.waitFor({state:'hidden'});
    await page.evaluate(polygon=>locationMapEditor.setWkt(polygon),polygon);
    await spinner.waitFor({state:'hidden'});
    assert.equal(await page.locator(`#${section}Section [data-map-canvas]`).getAttribute('aria-busy'),'false');
    await page.locator(`#${section}Section [data-map-command="fullscreen"]`).click();
    await page.waitForTimeout(150);
    assert.ok((await page.locator('.location-map-fullview [data-map-canvas]').boundingBox()).height>600);
    await page.locator('.location-map-fullview [data-map-command="fullscreen"]').click();
    await page.evaluate(()=>locationMapEditor.setWkt('invalid polygon'));
    assert.equal(await spinner.isVisible(),false);
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>locationMapEditor.destroy());await page.close();
    console.log(section,width,'centred loader, ready state, edits, invalid WKT and full view passed');
  }
  const page=await browser.newPage({viewport:{width:390,height:950}});
  await page.route('**/masters/location-hierarchy/zones/z/polygons',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.fulfill({json:{data:[{id:'z',name:'Zone',level:'zones',polygonDescription:polygon}]}});});
  await page.route('**/masters/market-types',r=>r.fulfill({json:{data:[]}}));
  await page.route('**/config/maps',r=>r.fulfill({json:{data:{olaMapsApiKey:'server-managed',olaMapsStyleUrl:'/admin/maps/style.json'}}}));
  await page.goto(`${process.argv[2]}/admin/`);
  await page.evaluate(polygon=>{window.previewPromise=renderPolygonMap({id:'z',name:'Zone',polygonDescription:polygon},'zones');},polygon);
  const loader=page.locator('#polygonMapWrap [data-map-loading]');
  await loader.waitFor({state:'visible'});
  await page.screenshot({path:'.codex-tmp-db-migrate/map-loading-preview-390.png'});
  await page.evaluate(()=>window.previewPromise);await loader.waitFor({state:'hidden'});
  await page.locator('#closePolygonModalButton').click();
  await page.evaluate(()=>renderPolygonMap({id:'bad',name:'Invalid',polygonDescription:'invalid'},'clusters'));
  assert.equal(await loader.isVisible(),false);
  assert.ok(await page.locator('#polygonMapAlert').isVisible());
  await page.locator('#closePolygonModalButton').click();await page.close();
  console.log('View on Map: delayed loading, ready state, invalid polygon error and cleanup passed');
} finally {await browser.close();}
