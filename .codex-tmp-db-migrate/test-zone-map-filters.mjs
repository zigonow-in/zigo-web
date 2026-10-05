import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const polygon=(x,size=.004)=>`POLYGON ((${x} 28.625,${x+size} 28.625,${x+size} 28.629,${x} 28.629,${x} 28.625))`;
const society={id:'society',name:'Society',color:'#ff0000',isActive:true};
const office={id:'office',name:'Office',color:'#0000ff',isActive:true};
const records=[
  {id:'z',name:'Zone One',level:'zones',polygonDescription:polygon(77.20,.04)},
  ...[1,2,3].map(i=>({id:`c${i}`,name:`Cluster ${i}`,level:'clusters',polygonDescription:polygon(77.20+i*.008)})),
  {id:'m',name:'Micro One',level:'micro-markets',polygonDescription:polygon(77.21)},
  {id:'n1',name:'Society Market',level:'nano-markets',polygonDescription:polygon(77.211),marketTypes:[society],polygonColor:society.color},
  {id:'n2',name:'Office Market',level:'nano-markets',polygonDescription:polygon(77.216),marketTypes:[office],polygonColor:office.color},
  {id:'n3',name:'Mixed Market',level:'nano-markets',polygonDescription:polygon(77.221),marketTypes:[society,office],polygonColor:society.color},
  {id:'n4',name:'Second Society Market',level:'nano-markets',polygonDescription:polygon(77.226),marketTypes:[society],polygonColor:society.color}
];
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let dataRequests=0;
    await page.route('**/config/maps',r=>r.fulfill({json:{data:{olaMapsApiKey:'server-managed',olaMapsStyleUrl:'/admin/maps/style.json'}}}));
    await page.route('**/masters/location-hierarchy/zones/z/polygons',r=>{dataRequests++;return r.fulfill({json:{data:records}});});
    await page.route('**/masters/market-types',r=>{dataRequests++;return r.fulfill({json:{data:[society,office,{id:'shop',name:'Shop',color:'#00ff00',isActive:true}]}});});
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async record=>{
      document.querySelector('#loginView').classList.add('d-none');document.querySelector('#adminView').classList.remove('d-none');
      await renderPolygonMap(record,'zones');
    },records[0]);
    const expectIds=async ids=>page.waitForFunction(ids=>JSON.stringify(polygonMapInstance?.getSource('cluster-polygon-source')?._data.features.map(f=>f.properties.id).sort())===JSON.stringify(ids.sort()),ids);
    try { await expectIds(records.map(r=>r.id)); } catch(error) {
      console.log(await page.evaluate(()=>({alert:document.querySelector('#polygonMapAlert').textContent,filters:document.querySelector('#polygonMapFilters').textContent,hasMap:Boolean(polygonMapInstance)})),errors);
      throw error;
    }
    await page.evaluate(()=>window.filterTestMap=polygonMapInstance);
    const assertFit = async () => {
      await page.waitForFunction(()=>!polygonMapInstance.isMoving());
      const fit=await page.evaluate(()=>{
        const map=polygonMapInstance, canvas=map.getCanvas();
        const points=map.getSource('cluster-polygon-source')._data.features.flatMap(f=>f.geometry.coordinates[0]).map(p=>map.project(p));
        const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
        return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),width:canvas.clientWidth,height:canvas.clientHeight};
      });
      assert.ok(fit.minX>=10 && fit.minY>=10 && fit.maxX<=fit.width-10 && fit.maxY<=fit.height-10,'Every outer vertex is inside the map');
      assert.ok(Math.max((fit.maxX-fit.minX)/fit.width,(fit.maxY-fit.minY)/fit.height)>.5,'Visible polygons use the available map size');
    };
    await assertFit();
    const initialZoom=await page.evaluate(()=>polygonMapInstance.getZoom());
    const root=page.locator('#polygonMapFilters');
    assert.deepEqual(await root.locator('[data-level-filter-summary] .polygon-level-count').allTextContents(),['1Z','3C','1MM','4NM']);
    assert.equal(await root.locator('[data-market-match-count]').textContent(),'4 / 4 Nano Market');
    assert.equal(await root.locator('[data-filter-count="type:all"]').textContent(),'5','Two types on one Nano Market are counted separately');
    assert.deepEqual(await root.locator('[data-level-filter-summary] .polygon-count-circle').last().evaluate(el=>{const style=getComputedStyle(el);return [style.width,style.height,style.borderRadius];}),['24px','24px','50%']);
    assert.equal(await root.locator('.polygon-market-type-group details').count(),0);
    assert.equal(await root.locator('[data-polygon-filter="level"][value="nano-markets"]').isDisabled(),false);
    assert.equal(await root.locator('[data-level-filter-summary] .polygon-level-count').evaluateAll(nodes=>new Set(nodes.map(n=>n.getBoundingClientRect().top)).size),1,'Compact summary stays on one row');
    assert.equal(await root.locator('[data-filter-count="type:society"]').textContent(),'3');
    assert.equal(await root.locator('[data-filter-count="type:office"]').textContent(),'2');
    await root.locator('[data-polygon-filter="type"][value="all"]').uncheck();
    await expectIds(records.map(r=>r.id));
    assert.equal(await root.locator('[data-market-match-count]').textContent(),'0 / 4 Nano Market');
    await page.waitForFunction(()=>polygonMapInstance.getSource('nano-market-color-sections')._data.features.length===0);
    await root.locator('[data-polygon-filter="type"][value="society"]').check();
    await expectIds(records.map(r=>r.id));
    assert.deepEqual(await root.locator('[data-level-filter-summary] .polygon-level-count').allTextContents(),['1Z','3C','1MM','4NM']);
    assert.equal(await root.locator('[data-market-match-count]').textContent(),'3 / 4 Nano Market');
    await page.waitForFunction(()=>polygonMapInstance.getSource('nano-market-color-sections')._data.features.length===4);
    await root.locator('[data-level-filter-summary]').click();
    await root.locator('[data-polygon-filter="level"][value="clusters"]').uncheck();
    assert.equal(await root.locator('.polygon-filter-dropdown').evaluate(el=>el.open),true,'Checkbox clicks leave the dropdown open');
    await page.locator('#polygonModalTitle').click();
    assert.equal(await root.locator('.polygon-filter-dropdown').evaluate(el=>el.open),false,'Outside click closes the dropdown');
    await root.locator('[data-level-filter-summary]').click();
    await expectIds(['z','m','n1','n2','n3','n4']);
    await root.locator('[data-polygon-filter="level"][value="all"]').check();
    await root.locator('[data-polygon-filter="level"][value="all"]').uncheck();
    await expectIds([]);
    await page.waitForFunction(()=>polygonMapInstance.getSource('nano-market-color-sections')._data.features.length===0);
    assert.equal(await root.locator('[data-level-filter-summary]').textContent(),'Select boundary');
    assert.equal(await root.locator('[data-polygon-filter="type"]:checked').count(),0);
    await root.locator('[data-polygon-filter="level"][value="nano-markets"]').check();
    await expectIds(['n1','n2','n3','n4']);
    await assertFit();
    assert.ok(await page.evaluate(initial=>polygonMapInstance.getZoom()>initial,initialZoom),'Smaller Nano Market bounds zoom in');
    await root.locator('[data-polygon-filter="level"][value="nano-markets"]').uncheck();
    await expectIds([]);
    await root.locator('[data-level-filter-summary]').click();
    await root.locator('[data-polygon-filter="type"][value="society"]').check();
    await expectIds(['n1','n3','n4']);
    assert.equal(await root.locator('[data-polygon-filter="level"][value="nano-markets"]').isChecked(),false);
    assert.equal(await root.locator('[data-level-filter-summary]').textContent(),'3NM');
    await root.locator('[data-polygon-filter="type"][value="all"]').check();
    await expectIds(['n1','n2','n3','n4']);
    await root.locator('[data-polygon-filter="type"][value="all"]').uncheck();
    await expectIds([]);
    await root.locator('[data-polygon-filter="type"][value="office"]').check();
    await expectIds(['n2','n3']);
    await root.locator('[data-level-filter-summary]').click();
    await root.locator('[data-polygon-filter="level"][value="all"]').check();
    await expectIds(records.map(r=>r.id));
    await root.locator('[data-level-filter-summary]').click();
    await page.screenshot({path:`.codex-tmp-db-migrate/zone-map-filters-${width}.png`,fullPage:true});
    await root.locator('[data-polygon-filter="type"][value="all"]').check();
    await expectIds(records.map(r=>r.id));
    await assertFit();
    const beforeZoom=await page.evaluate(()=>polygonMapInstance.getZoom());
    await page.locator('[data-map-view-command="zoom-in"]').click();
    await page.waitForFunction(before=>!polygonMapInstance.isMoving() && polygonMapInstance.getZoom()>before+.8,beforeZoom);
    await page.locator('[data-map-view-command="zoom-out"]').click();
    await page.waitForFunction(before=>!polygonMapInstance.isMoving() && Math.abs(polygonMapInstance.getZoom()-before)<.05,beforeZoom);
    await page.locator('[data-map-view-command="fit"]').click(); await assertFit();
    await page.locator('#polygonMapFullWidthButton').click();
    assert.equal(await page.locator('#polygonMapFullWidthButton').getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(550); await assertFit();
    const fullBounds=await page.locator('#polygonModal .map-modal-card').boundingBox();
    assert.ok(fullBounds.width>=width-20 && fullBounds.x<=10,'Full-width view fills the viewport');
    await page.screenshot({path:`.codex-tmp-db-migrate/zone-map-fullwidth-${width}.png`,fullPage:true});
    await page.locator('#polygonMapFullWidthButton').focus();await page.keyboard.press('Escape');
    assert.equal(await page.locator('#polygonMapFullWidthButton').getAttribute('aria-pressed'),'false');
    await page.waitForTimeout(550);await assertFit();
    assert.equal(await page.evaluate(()=>filterTestMap===polygonMapInstance),true,'Map instance is retained');
    assert.equal(dataRequests,2,'Filters do not refetch data');
    assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#closePolygonModalButton').click();
    assert.equal(await page.evaluate(()=>polygonMapInstance===null && polygonMapCleanup===null),true);
    await page.close();
    console.log(width,'Filters, automatic fit, every vertex onscreen, zoom controls, full-width, Escape and cleanup passed');
  }
} finally {await browser.close();}
