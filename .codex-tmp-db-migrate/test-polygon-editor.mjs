import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const origin = process.argv[2];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const wkt = 'POLYGON ((77.21 28.63,77.22 28.63,77.22 28.64,77.21 28.64,77.21 28.63))';
const id = '11111111-1111-4111-8111-111111111111';
const parentId = '22222222-2222-4222-8222-222222222222';
try {
  for (const width of [1280,390]) {
    const page = await browser.newPage({ viewport:{width,height:950},hasTouch:true });
    const errors=[];
    let saved;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/masters/cities',route=>route.fulfill({json:{data:[{id:parentId,name:'Delhi'}]}}));
    await page.route('**/masters/location-hierarchy/**',route=>{
      if (route.request().method()==='PUT') { saved=route.request().postDataJSON(); return route.fulfill({json:{data:{id}}}); }
      return route.fulfill({json:{data:[{id,parentId,name:'Test boundary',code:'TEST',polygonDescription:wkt,isOpen:true},{id:parentId,name:'Parent boundary',code:'PARENT',polygonDescription:wkt,isOpen:true}]}});
    });
    await page.goto(`${origin}/admin/`);
    await page.evaluate(async()=>{
      document.querySelector('#loginView').classList.add('d-none');
      document.querySelector('#adminView').classList.remove('d-none');
      state.section='zones';
      document.querySelector('#zonesSection').classList.remove('d-none');
      await loadLocationHierarchyPage('zones');
    });
    await page.waitForFunction(()=>locationMapEditor?.draw);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Editor page fits viewport');
    const form=page.locator('#zonesSection [data-location-hierarchy-form]');
    const textarea=form.locator('[name="polygonDescription"]');
    await page.locator('#zonesSection [data-location-command="edit"]').first().click();
    assert.equal((await textarea.inputValue()).replaceAll(' ',''),wkt.replaceAll(' ',''));
    await form.locator('[data-map-command="polygon"]').click();
    const mapCanvas=form.locator('[data-map-canvas] canvas');
    await mapCanvas.scrollIntoViewIfNeeded();
    const box=await mapCanvas.boundingBox();
    const points=[[0.3,0.3],[0.7,0.3],[0.7,0.7],[0.3,0.7],[0.3,0.3]];
    for (const [x,y] of points) {
      if (width < 600) await page.touchscreen.tap(box.x+box.width*x,box.y+box.height*y);
      else await page.mouse.click(box.x+box.width*x,box.y+box.height*y);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(500);
    const drawn=await textarea.inputValue();
    assert.match(drawn,/^POLYGON \(\(/);
    assert.notEqual(drawn,wkt,'Drawing updates WKT');
    assert.equal(await page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length),1,'One boundary per location');
    const vertex=await page.evaluate(()=>{
      const ring=locationMapEditor.draw.getSnapshot().find(f=>f.geometry.type==='Polygon').geometry.coordinates[0];
      const point=locationMapEditor.map.project(ring[0]); const rect=locationMapEditor.map.getCanvas().getBoundingClientRect();
      return {x:rect.left+point.x,y:rect.top+point.y};
    });
    if (width < 600) {
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...vertex,id:0}]});
      for(let step=1;step<=8;step++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vertex.x+step*2.25,y:vertex.y+step*2.25,id:0}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else {
      await page.mouse.move(vertex.x,vertex.y); await page.mouse.down(); await page.mouse.move(vertex.x+18,vertex.y+18,{steps:8}); await page.mouse.up();
    }
    await page.waitForTimeout(500);
    const edited=await textarea.inputValue();
    assert.notEqual(edited,drawn,'Vertex drag updates WKT');
    await form.locator('[data-map-command="undo"]').click(); await page.waitForTimeout(250);
    assert.equal(await textarea.inputValue(),drawn,'Undo restores boundary');
    await form.locator('[data-map-command="redo"]').click(); await page.waitForTimeout(250);
    assert.equal(await textarea.inputValue(),edited,'Redo restores vertex edit');
    await form.locator('[data-map-command="freehand"]').click();
    await mapCanvas.scrollIntoViewIfNeeded();
    const freeBox=await mapCanvas.boundingBox();
    const stroke=Array.from({length:61},(_,i)=>({x:freeBox.x+freeBox.width/2+Math.cos(i*Math.PI/30)*freeBox.width*0.24,y:freeBox.y+180+Math.sin(i*Math.PI/30)*85}));
    const centerBefore=await page.evaluate(()=>locationMapEditor.map.getCenter().toArray());
    if(width<600) {
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...stroke[0],id:0}]});
      for(const point of stroke.slice(1)) { await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:0}]}); await page.waitForTimeout(8); }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else {
      await page.mouse.move(stroke[0].x,stroke[0].y); await page.mouse.down();
      for(const point of stroke.slice(1)) await page.mouse.move(point.x,point.y);
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
    const freeWkt=await textarea.inputValue();
    assert.notEqual(freeWkt,edited,'Freehand updates WKT');
    const ring=await page.evaluate(()=>locationMapEditor.draw.getSnapshot().find(f=>f.geometry.type==='Polygon').geometry.coordinates[0]);
    assert.ok(ring.length>10,'Freehand retains traced shape');
    assert.deepEqual(ring[0],ring.at(-1),'Freehand closes boundary');
    assert.deepEqual(await page.evaluate(()=>locationMapEditor.map.getCenter().toArray()),centerBefore,'Freehand does not pan map');
    assert.equal(await page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length),1);
    assert.equal(await form.locator('[data-map-command="select"]').getAttribute('aria-pressed'),'true','Freehand becomes editable');
    await form.locator('[data-map-command="undo"]').click(); await page.waitForTimeout(250);
    assert.equal(await textarea.inputValue(),edited,'Undo restores previous polygon after freehand');
    await form.locator('[data-map-command="redo"]').click(); await page.waitForTimeout(250);
    assert.equal(await textarea.inputValue(),freeWkt,'Redo restores freehand polygon');
    await textarea.fill(wkt); await textarea.blur(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length),1,'WKT input updates drawing');
    await page.screenshot({path:`.codex-tmp-db-migrate/editor-${width}.png`,fullPage:true});
    await form.locator('[type="submit"]').click();
    await page.waitForTimeout(800);
    assert.equal(saved?.polygonDescription.replaceAll(' ',''),wkt.replaceAll(' ',''),'Save submits boundary WKT through existing endpoint');
    await page.waitForFunction(()=>locationMapEditor?.draw);
    await page.evaluate(()=>locationMapEditor.setWkt('POLYGON ((77.21 28.63,77.22 28.63,77.22 28.64,77.21 28.64,77.21 28.63))'));
    await form.locator('[data-map-command="clear"]').click();
    assert.equal(await textarea.inputValue(),'','Clear empties WKT');
    await form.locator('[data-map-command="undo"]').click();
    assert.match(await textarea.inputValue(),/^POLYGON/,'Undo restores cleared polygon');
    await form.locator('[type="reset"]').click(); await page.waitForTimeout(200);
    assert.equal(await textarea.inputValue(),'','Cancel resets WKT');
    assert.equal(await page.evaluate(()=>locationMapEditor.draw.getSnapshot().filter(f=>f.geometry.type==='Polygon').length),0,'Cancel clears drawn polygon');
    if(width===1280) for(const section of ['clusters','microMarkets','nanoMarkets']) {
      await page.evaluate(async section=>{
        state.section=section;
        document.querySelectorAll('.page-section').forEach(element=>element.classList.add('d-none'));
        document.querySelector(`#${section}Section`).classList.remove('d-none');
        await loadLocationHierarchyPage(section);
      },section);
      assert.equal(await page.locator(`#${section}Section [data-map-canvas] canvas`).isVisible(),true,`${section} map is always visible`);
    }
    await page.evaluate(()=>locationMapEditor?.destroy());
    assert.deepEqual(errors,[]);
    console.log(width,'Polygon/freehand drawing, vertex edit, WKT sync, undo/redo and save passed');
    await page.close();
  }
} finally {await browser.close();}
