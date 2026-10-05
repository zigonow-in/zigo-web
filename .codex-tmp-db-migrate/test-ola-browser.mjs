import { chromium } from './browser-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = process.argv[2] || 'http://127.0.0.1:4011';
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, hasTouch: true });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/config/maps', route => route.fulfill({ json: { data: { olaMapsApiKey: 'server-managed', olaMapsStyleUrl: '/admin/maps/style.json' } } }));
    await page.route('**/location-hierarchy/zones/*/polygons', route => route.fulfill({ json: { data: [
      { id:'zone', name:'Zone', level:'zones', polygonDescription:'POLYGON ((77.21 28.63,77.22 28.63,77.22 28.64,77.21 28.64,77.21 28.63))' },
      { id:'cluster', name:'Cluster', level:'clusters', polygonDescription:'POLYGON ((77.211 28.631,77.219 28.631,77.219 28.639,77.211 28.639,77.211 28.631))' },
      { id:'mm', name:'Micro Market', level:'micro-markets', polygonDescription:'POLYGON ((77.212 28.632,77.218 28.632,77.218 28.638,77.212 28.638,77.212 28.632))' },
      { id:'nm', name:'Nano Market', level:'nano-markets', polygonDescription:'POLYGON ((77.213 28.633,77.217 28.633,77.217 28.637,77.213 28.637,77.213 28.633))' }
    ] } }));
    await page.goto(`${origin}/admin/`);
    await page.waitForFunction(() => typeof renderPolygonMap === 'function');
    await page.evaluate(async () => {
      await renderPolygonMap({ id:'test-zone', name:'Map verification', polygonDescription:'POLYGON ((77.21 28.63,77.22 28.63,77.22 28.64,77.21 28.64,77.21 28.63))' }, 'zones');
      window.map = polygonMapInstance;
      if (!map) throw new Error(document.querySelector('#polygonMapAlert').textContent);
    });
    await page.evaluate(async () => {
      if (!map.isStyleLoaded()) await new Promise(resolve => map.once('load', resolve));
      const features = map.getSource('cluster-polygon-source')._data.features;
      if (JSON.stringify(features.map(feature => feature.properties.color)) !== JSON.stringify(['#005df2','#16a34a','#f97316','#dc2626'])) throw new Error('Hierarchy colours or order are incorrect');
    });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `.codex-tmp-db-migrate/hierarchy-${viewport.width}.png` });
    await page.evaluate(() => {
      window.resizeCalls = 0;
      const original = map.resize.bind(map);
      map.resize = (...args) => { resizeCalls++; return original(...args); };
    });
    const session = await page.context().newCDPSession(page);
    const box = await page.locator('#polygonMap canvas').boundingBox();
    const touch = (x, y, id = 0) => ({ x, y, id });
    const x = box.x + box.width / 2;
    const y = box.y + Math.min(box.height / 2, 160);
    for (let drag = 0; drag < 6; drag++) {
      const before = await page.evaluate(() => map.getCenter().lng);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(x, y)] });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(x + step * 8, y + step * 2)] });
        await page.waitForTimeout(30);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(450);
      assert.notEqual(await page.evaluate(() => map.getCenter().lng), before, `Touch drag ${drag + 1} moves the map`);
    }
    const zoomBefore = await page.evaluate(() => map.getZoom());
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(x - 25, y, 0), touch(x + 25, y, 1)] });
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(x - 25 - step * 5, y - step * 2, 0), touch(x + 25 + step * 5, y + step * 2, 1)] });
      await page.waitForTimeout(30);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(700);
    assert.ok(await page.evaluate(() => map.getZoom()) > zoomBefore, 'Pinch zoom works after repeated drags');
    assert.equal(await page.evaluate(() => resizeCalls), 0, 'Map does not resize itself after gestures');
    console.log(viewport.width, 'Six touch drags and pinch zoom passed without resize interruptions');
    const screenshot = await page.screenshot({ path: `.codex-tmp-db-migrate/ola-${viewport.width}.png` });
    const pixels = await page.evaluate(async (url) => {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
      const context=canvas.getContext('2d'); context.drawImage(image,0,0);
      const data=context.getImageData(0,0,canvas.width,canvas.height).data;
      const colors = new Set();
      for (let i=0;i<data.length;i+=128) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
      const initial = map.getCenter().lng;
      map.panBy([80,0],{duration:0});
      map.zoomTo(14,{duration:0});
      return { colors:colors.size, moved:map.getCenter().lng !== initial, zoom:map.getZoom(), polygon:!!map.getLayer('cluster-polygon-fill') };
    }, `data:image/png;base64,${screenshot.toString('base64')}`);
    assert.ok(pixels.colors > 20, JSON.stringify(pixels));
    assert.ok(pixels.moved && pixels.zoom === 14 && pixels.polygon);
    assert.deepEqual(failures, []);
    assert.equal(await page.locator('#polygonMapAlert').isVisible(), false, 'No map resource warnings');
    console.log(viewport.width, pixels);
    await page.close();
  }
} finally { await browser.close(); }
