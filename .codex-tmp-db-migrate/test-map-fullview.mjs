import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:true});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/cities',route=>route.fulfill({json:{data:[{id:'city',name:'Delhi'}]}}));
    await page.route('**/masters/location-hierarchy/zones',route=>route.fulfill({json:{data:[]}}));
    await page.goto(`${process.argv[2]}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');document.querySelector('#adminView').classList.remove('d-none');
      state.section='zones';document.querySelector('#zonesSection').classList.remove('d-none');await loadLocationHierarchyPage('zones');
      window.originalMap=locationMapEditor.map;
    });
    const editor=page.locator('[data-location-map-editor]');
    const textbox=page.locator('#zonesSection [name="polygonDescription"]');
    await editor.locator('[data-map-command="fullscreen"]').click();
    const bounds=await editor.boundingBox();
    assert.deepEqual({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},{x:0,y:0,width,height:900});
    assert.equal(await page.evaluate(()=>locationMapEditor.map===originalMap),true,'Full view retains map instance');
    await editor.locator('[data-map-command="linestring"]').click();
    const canvas=editor.locator('[data-map-canvas] canvas');
    const box=await canvas.boundingBox();
    for(const [x,y] of [[0.3,0.3],[0.7,0.3],[0.7,0.7],[0.3,0.7]]) {
      if(width<600) await page.touchscreen.tap(box.x+box.width*x,box.y+box.height*y);
      else await page.mouse.click(box.x+box.width*x,box.y+box.height*y);
      await page.waitForTimeout(80);
    }
    assert.equal(await textbox.inputValue(),'','Line segments do not save an unfinished polygon');
    await editor.locator('[data-map-command="finish"]').click(); await page.waitForTimeout(300);
    const value=await textbox.inputValue(); assert.match(value,/^POLYGON/,'Finish converts lines to polygon');
    const ring=await page.evaluate(()=>locationMapEditor.draw.getSnapshot().find(f=>f.geometry.type==='Polygon').geometry.coordinates[0]);
    assert.deepEqual(ring[0],ring.at(-1)); assert.equal(new Set(ring.map(point=>point.join(','))).size,4);
    await page.screenshot({path:`.codex-tmp-db-migrate/fullview-${width}.png`});
    await page.keyboard.press('Escape');
    assert.equal(await editor.getAttribute('aria-modal'),null,'Escape exits full view');
    assert.equal(await textbox.inputValue(),value,'Exiting full view preserves polygon');
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await editor.locator('[data-map-command="fullscreen"]').click();
    await editor.locator('[data-map-command="freehand"]').click();
    const freeBox=await canvas.boundingBox();
    const stroke=Array.from({length:51},(_,i)=>({x:freeBox.x+freeBox.width/2+Math.cos(i*Math.PI/25)*Math.min(freeBox.width*0.25,150),y:freeBox.y+freeBox.height/2+Math.sin(i*Math.PI/25)*100}));
    if(width<600) {
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...stroke[0],id:0}]});
      for(const point of stroke.slice(1)) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:0}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else {
      await page.mouse.move(stroke[0].x,stroke[0].y);await page.mouse.down();
      for(const point of stroke.slice(1)) await page.mouse.move(point.x,point.y);
      await page.mouse.up();
    }
    await page.waitForTimeout(300);assert.notEqual(await textbox.inputValue(),value,'Freehand works in full view');
    await editor.locator('[data-map-command="fullscreen"]').click();
    assert.equal(await editor.getAttribute('aria-modal'),null,'Button exits full view');
    await editor.locator('[data-map-command="fullscreen"]').click();
    await page.evaluate(()=>locationMapEditor.destroy());
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'','Destroy restores body scrolling');
    assert.equal(await page.locator('.location-map-fullview').count(),0);
    assert.deepEqual(errors,[]);
    console.log(width,'Connected lines, Finish, full-view drawing, Escape and cleanup passed');await page.close();
  }
} finally {await browser.close();}
