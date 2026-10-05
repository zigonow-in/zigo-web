import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const polygon = (left, bottom, size) => `POLYGON ((${left} ${bottom},${left+size} ${bottom},${left+size} ${bottom+size},${left} ${bottom+size},${left} ${bottom}))`;
const zones = [{id:'zone-a',name:'Zone A',polygonDescription:polygon(77.20,28.62,0.03)}, {id:'zone-b',name:'Zone B',polygonDescription:polygon(77.235,28.62,0.03)}];
const clusters = [
  {id:'cluster-a',parentId:'zone-a',name:'Cluster A',code:'CA',polygonDescription:polygon(77.205,28.625,0.008),isOpen:true},
  {id:'cluster-b',parentId:'zone-a',name:'Cluster B',code:'CB',polygonDescription:polygon(77.215,28.625,0.008),isOpen:true},
  {id:'cluster-c',parentId:'zone-b',name:'Cluster C',code:'CC',polygonDescription:polygon(77.240,28.625,0.008),isOpen:true}
];
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950},hasTouch:true});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/location-hierarchy/clusters',route=>route.fulfill({json:{data:clusters}}));
    await page.route('**/masters/location-hierarchy/zones',route=>route.fulfill({json:{data:zones}}));
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');
      document.querySelector('#adminView').classList.remove('d-none');
      state.section='clusters'; document.querySelector('#clustersSection').classList.remove('d-none');
      await loadLocationHierarchyPage('clusters');
    });
    const expectReferences=async(expected,message)=>{
      await page.waitForFunction(expected=>JSON.stringify(locationMapEditor.map.getSource('editor-reference')._data.features.map(f=>f.properties.id).sort())===JSON.stringify(expected),expected);
      assert.deepEqual(await page.evaluate(()=>locationMapEditor.map.getSource('editor-reference')._data.features.map(f=>f.properties.id).sort()),expected,message);
    };
    const editable=()=>page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length);
    await expectReferences(['cluster-a','cluster-b','cluster-c'],'New form shows all clusters');
    assert.equal(await editable(),0,'Reference clusters are not editable');
    const form=page.locator('#clustersSection [data-location-hierarchy-form]');
    const zone=form.locator('[name="parentId"]');
    const wkt=form.locator('[name="polygonDescription"]');
    await zone.selectOption('zone-a');
    await expectReferences(['cluster-a','cluster-b'],'Zone selection filters clusters');
    assert.equal(await wkt.inputValue(),'','Zone selection does not populate a cluster polygon');
    await page.locator('#clustersSection [data-location-command="edit"][data-id="cluster-a"]').click();
    await page.waitForTimeout(200);
    await expectReferences(['cluster-b'],'Edited cluster is not duplicated in reference layer');
    assert.equal(await editable(),1,'Only the selected cluster is editable');
    const original=await wkt.inputValue();
    await zone.selectOption('zone-b');
    await expectReferences(['cluster-c'],'Changing Zone while editing updates context');
    assert.equal(await wkt.inputValue(),original,'Changing Zone preserves current polygon');
    await zone.selectOption('');
    await expectReferences(['cluster-b','cluster-c'],'Clearing Zone shows all other clusters');
    assert.equal(await wkt.inputValue(),original);
    await form.locator('[type="reset"]').click(); await page.waitForTimeout(250);
    await expectReferences(['cluster-a','cluster-b','cluster-c'],'Cancel restores all clusters');
    assert.equal(await wkt.inputValue(),'');
    await zone.selectOption('zone-a');
    await wkt.fill(clusters[0].polygonDescription); await wkt.blur(); await page.waitForTimeout(500);
    assert.equal(await editable(),1,'New boundary remains independently editable');
    await expectReferences(['cluster-a','cluster-b']);
    await page.screenshot({path:`.codex-tmp-db-migrate/cluster-context-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>locationMapEditor.destroy()); await page.close();
    console.log(width,'All clusters, Zone filtering, edit exclusion, WKT preservation and reset passed');
  }
} finally {await browser.close();}
