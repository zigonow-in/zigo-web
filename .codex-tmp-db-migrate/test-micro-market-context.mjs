import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const polygon = (x, y, s) => `POLYGON ((${x} ${y},${x+s} ${y},${x+s} ${y+s},${x} ${y+s},${x} ${y}))`;
const parents = [{id:'c1',name:'Cluster One',polygonDescription:polygon(77.20,28.62,.03)}, {id:'c2',name:'Cluster Two',polygonDescription:polygon(77.24,28.62,.03)}];
const records = [
  {id:'m1',parentId:'c1',name:'Market One',code:'M1',polygonDescription:polygon(77.205,28.625,.008),isOpen:true},
  {id:'m2',parentId:'c1',name:'Market Two',code:'M2',polygonDescription:polygon(77.215,28.625,.008),isOpen:true},
  {id:'m3',parentId:'c2',name:'Market Three',code:'M3',polygonDescription:polygon(77.245,28.625,.008),isOpen:true}
];
try {
  for (const width of [1280,390]) {
    const page = await browser.newPage({viewport:{width,height:950},hasTouch:true});
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/masters/location-hierarchy/micro-markets',r=>r.fulfill({json:{data:records}}));
    await page.route('**/masters/location-hierarchy/clusters',r=>r.fulfill({json:{data:parents}}));
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');
      document.querySelector('#adminView').classList.remove('d-none');
      state.section='microMarkets'; document.querySelector('#microMarketsSection').classList.remove('d-none');
      await loadLocationHierarchyPage('microMarkets');
    });
    const expectSource = async (source,property,expected) => {
      await page.waitForFunction(({source,property,expected})=>JSON.stringify(locationMapEditor.map.getSource(source)._data.features.map(f=>f.properties[property]).sort())===JSON.stringify(expected.sort()),{source,property,expected});
    };
    const form = page.locator('#microMarketsSection [data-location-hierarchy-form]');
    const cluster = form.locator('[name="parentId"]');
    const wkt = form.locator('[name="polygonDescription"]');
    await cluster.selectOption('c1');
    await expectSource('editor-reference','id',['m1','m2']);
    await expectSource('editor-name-labels','name',['Market One','Market Two']);
    assert.equal(await wkt.inputValue(),'');
    await page.locator('#microMarketsSection [data-location-command="edit"][data-id="m1"]').click();
    await expectSource('editor-reference','id',['m2']);
    await expectSource('editor-name-labels','name',['Market One','Market Two']);
    const original = await wkt.inputValue();
    await form.locator('[name="name"]').fill('Renamed Market');
    await expectSource('editor-name-labels','name',['Renamed Market','Market Two']);
    await cluster.selectOption('c2');
    await expectSource('editor-reference','id',['m3']);
    await expectSource('editor-name-labels','name',['Renamed Market','Market Three']);
    assert.equal(await wkt.inputValue(),original);
    assert.equal(await page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length),1);
    const layout = await page.evaluate(()=>locationMapEditor.map.getLayer('editor-reference-label').serialize().layout);
    assert.deepEqual(layout['text-font'],['Gentona Bold']);
    assert.equal(layout['icon-text-fit'],'both');
    await cluster.selectOption('c1');
    await expectSource('editor-reference','id',['m2']);
    await page.waitForTimeout(1500);
    await page.screenshot({path:`.codex-tmp-db-migrate/micro-market-context-${width}.png`,fullPage:true});
    await form.locator('[type="reset"]').click();
    await expectSource('editor-reference','id',['m1','m2','m3']);
    await expectSource('editor-name-labels','name',['Market One','Market Two','Market Three']);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>locationMapEditor.destroy());
    await page.close(); console.log(width,'Micro Market filtering, labels, edit, rename, reset and layout passed');
  }
} finally { await browser.close(); }
