import { TerraDraw, TerraDrawPolygonMode, TerraDrawLineStringMode, TerraDrawFreehandMode, TerraDrawSelectMode, TerraDrawRenderMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { createIcons, Hand, Pentagon, Waypoints, Pencil, Check, Maximize2, Minimize2, MousePointer2, Trash2, LocateFixed, Undo2, Redo2, Plus, Minus, Scan } from 'lucide';
import { splitMarketSections } from '../utils/marketSections.ts';
import { createMapLoading } from './map-loading.js';

export function polygonToWkt(feature) {
  const ring = feature.geometry.coordinates[0];
  return `POLYGON ((${ring.map(point => point.map(value => Number(value.toFixed(9))).join(' ')).join(', ')}))`;
}

async function create({ root, textarea, parseWkt, color, parentColor, nameInput, labelStrips = false }) {
  const toolbar = root.querySelector('[data-map-tools]');
  const canvas = root.querySelector('[data-map-canvas]');
  const message = root.querySelector('[data-map-message]');
  const loading = createMapLoading(root, canvas, () => { message.textContent = 'Map loading timed out. Refresh to retry.'; });
  const tools = [['navigate', 'Hand', 'Pan map'], ['polygon', 'Pentagon', 'Draw polygon'], ['linestring', 'Waypoints', 'Draw connected lines'], ['freehand', 'Pencil', 'Freehand polygon'], ['finish', 'Check', 'Finish boundary'], ['select', 'MousePointer2', 'Edit vertices'], ['undo', 'Undo2', 'Undo'], ['redo', 'Redo2', 'Redo'], ['fit', 'LocateFixed', 'Fit boundary'], ['clear', 'Trash2', 'Clear polygon'], ['fullscreen', 'Maximize2', 'Full view map']];
  toolbar.innerHTML = tools.map(([command, icon, label]) => `<button type="button" class="location-map-tool" data-map-command="${command}" title="${label}" aria-label="${label}" disabled><i data-lucide="${icon}"></i></button>`).join('');
  const icons = { Hand, Pentagon, Waypoints, Pencil, Check, Maximize2, Minimize2, MousePointer2, Trash2, LocateFixed, Undo2, Redo2 };
  createIcons({ icons });
  message.textContent = 'Loading map...';
  await window.ZigoMaps.loadSdk().catch(error => { loading.destroy(); throw error; });
  if (!root.isConnected) { loading.destroy(); return { destroy() {} }; }
  const sdk = new window.OlaMaps({ apiKey: 'server-managed' });
  const map = await Promise.resolve().then(() => sdk.init({ container: canvas, style: window.ZigoMaps.styleUrl, transformRequest: window.ZigoMaps.transformRequest, center: [77.2167, 28.6315], zoom: 11 })).catch(error => { loading.destroy(); throw error; });
  loading.connect(map, ['editor-parent', 'editor-reference', 'editor-market-sections', ...(labelStrips ? ['editor-name-labels'] : [])]);
  await new Promise((resolve, reject) => {
    if (map.isStyleLoaded()) return resolve();
    const timer = setTimeout(() => { map.remove(); reject(new Error('Map loading timed out. Refresh to retry.')); }, 20000);
    map.once('load', () => { clearTimeout(timer); resolve(); });
    map.once('remove', () => { clearTimeout(timer); resolve(); });
  }).catch(error => { loading.destroy(); throw error; });
  if (!root.isConnected) { loading.destroy(); map.remove(); return { destroy() {} }; }
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('editor-parent', { type: 'geojson', data: empty });
  map.addLayer({ id: 'editor-parent-fill', type: 'fill', source: 'editor-parent', paint: { 'fill-color': parentColor, 'fill-opacity': 0.06 } });
  map.addLayer({ id: 'editor-parent-line', type: 'line', source: 'editor-parent', paint: { 'line-color': parentColor, 'line-width': 2, 'line-dasharray': [3, 2] } });
  map.addSource('editor-reference', { type: 'geojson', data: empty });
  map.addLayer({ id: 'editor-reference-fill', type: 'fill', source: 'editor-reference', paint: { 'fill-color': ['coalesce', ['get', 'color'], color], 'fill-opacity': ['case', ['get', 'hasSections'], 0, 0.08] } });
  map.addLayer({ id: 'editor-reference-line', type: 'line', source: 'editor-reference', paint: { 'line-color': ['coalesce', ['get', 'color'], color], 'line-width': 2 } });
  map.addSource('editor-market-sections', { type: 'geojson', data: empty });
  map.addLayer({ id: 'editor-market-sections-fill', type: 'fill', source: 'editor-market-sections', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.28 } });
  function ensureStrip(stripColor, colors = [stripColor]) {
    const imageId = `editor-name-strip-${colors.map(c=>c.slice(1)).join('-')}`;
    if (map.hasImage(imageId)) return imageId;
    const strip = document.createElement('canvas'); strip.width = 24*colors.length; strip.height = 24;
    const context = strip.getContext('2d');
    colors.forEach((value,index)=>{context.fillStyle=value;context.fillRect(index*24,0,24,24);});
    map.addImage(imageId, context.getImageData(0, 0, strip.width, 24), { stretchX: [[0, strip.width]], stretchY: [[0, 24]], content: [0, 0, strip.width, 24] });
    return imageId;
  }
  if (labelStrips) {
    ensureStrip(color);
    map.addSource('editor-name-labels', { type: 'geojson', data: empty });
  }
  map.addLayer({ id: 'editor-reference-label', type: 'symbol', source: labelStrips ? 'editor-name-labels' : 'editor-reference', layout: { 'text-field': ['get', 'name'], 'text-font': [labelStrips ? 'Gentona Bold' : 'Gentona Book'], 'text-size': labelStrips ? 12 : 11, ...(labelStrips ? { 'icon-image': ['get', 'strip'], 'icon-text-fit': 'both', 'icon-text-fit-padding': [4, 8, 4, 8] } : {}) }, paint: { 'text-color': labelStrips ? ['get', 'textColor'] : color, 'text-halo-color': '#ffffff', 'text-halo-width': labelStrips ? 0 : 1.5 } });
  const draw = new TerraDraw({ adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 9 }), modes: [
    new TerraDrawRenderMode({ modeName: 'navigate', styles: {} }),
    new TerraDrawPolygonMode({ styles: { fillColor: color, fillOpacity: 0.18, outlineColor: color, outlineWidth: 2 } }),
    new TerraDrawLineStringMode({ showCoordinatePoints: true, keyEvents: { finish: 'Enter', cancel: 'Escape' }, styles: { lineStringColor: color, lineStringWidth: 2, coordinatePointColor: color } }),
    new TerraDrawFreehandMode({ drawInteraction: 'click-drag', minDistance: 4, styles: { fillColor: color, fillOpacity: 0.18, outlineColor: color, outlineWidth: 2 } }),
    new TerraDrawSelectMode({
      styles: { selectedPolygonColor: color, selectedPolygonFillOpacity: 0.18, selectedPolygonOutlineColor: color, selectedPolygonOutlineWidth: 2, selectionPointColor: color, selectionPointWidth: 7, midPointColor: color },
      flags: { polygon: { feature: { draggable: true, selfIntersectable: false, coordinates: { draggable: true, deletable: true, midpoints: { draggable: true } } } } }
    })
  ] });
  draw.start();
  let mode = 'navigate';
  let syncing = false;
  let timer;
  let parentRing = null;
  let referenceRings = [];
  let referenceFeatures = [];
  let referenceSections = [];
  let currentMarketTypes = [];
  let sectionKey = '';
  let currentSections = [];
  let history = [''];
  let position = 0;
  let fullView = false;
  let placeholder;
  let previousOverflow;
  let previousFocus;
  const drawingModes = ['polygon', 'linestring', 'freehand'];
  const polygons = () => draw.getSnapshot().filter(feature => feature.geometry.type === 'Polygon' && !feature.properties.currentlyDrawing);
  function updateNameLabels() {
    if (!labelStrips) return;
    const current = polygons()[0];
    const name = nameInput?.value.trim();
    const features = [...referenceFeatures];
    if (current && name) features.push({ type: 'Feature', geometry: current.geometry, properties: { name, color, marketTypes: currentMarketTypes } });
    const nextKey = JSON.stringify([current?.geometry, currentMarketTypes]);
    if (sectionKey !== nextKey) {
      sectionKey = nextKey;
      currentSections = current ? splitMarketSections(current.geometry.coordinates, currentMarketTypes) : [];
    }
    map.getSource('editor-market-sections').setData({ type: 'FeatureCollection', features: [...referenceSections, ...currentSections] });
    features.forEach(feature => {
      const labelColor = feature.properties.color || color;
      const colors = feature.properties.marketTypes?.map(type=>type.color).filter(value=>/^#[0-9a-f]{6}$/i.test(value));
      feature.properties.strip = ensureStrip(labelColor, colors?.length ? colors : [labelColor]);
      const rgb = [1,3,5].map(offset => parseInt(labelColor.slice(offset,offset+2),16));
      feature.properties.textColor = rgb[0]*0.299 + rgb[1]*0.587 + rgb[2]*0.114 > 165 ? '#111827' : '#ffffff';
    });
    map.getSource('editor-name-labels').setData({ type: 'FeatureCollection', features });
  }
  function updateButtons() {
    toolbar.querySelectorAll('button').forEach(button => {
      const command = button.dataset.mapCommand;
      button.disabled = (command === 'undo' && position === 0) || (command === 'redo' && position === history.length - 1);
      if (command === 'finish') button.disabled = !['polygon', 'linestring'].includes(mode) || draw.getModeState() !== 'drawing';
      if (['navigate', ...drawingModes, 'select'].includes(command)) button.setAttribute('aria-pressed', String(command === mode));
    });
  }
  function setMode(next) {
    draw.setMode(next); mode = next;
    if (next === 'select' && polygons()[0]) draw.selectFeature(polygons()[0].id);
    updateButtons();
  }
  function remember(value) {
    if (history[position] === value) return;
    history = history.slice(0, position + 1); history.push(value);
    if (history.length > 50) history.shift();
    position = history.length - 1; updateButtons();
  }
  function write(value) {
    syncing = true; textarea.value = value; textarea.setCustomValidity('');
    textarea.dispatchEvent(new Event('input', { bubbles: true })); syncing = false;
  }
  function syncFromDraw() {
    if (syncing || drawingModes.includes(mode)) return;
    const feature = polygons()[0];
    const value = feature ? polygonToWkt(feature) : '';
    write(value); remember(value); updateNameLabels();
  }
  function fit(ring) {
    if (!ring?.length) return;
    const lngs = ring.map(point => point[0]); const lats = ring.map(point => point[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 36, duration: 0, maxZoom: 18 });
  }
  function setWkt(value, { record = false, fitMap = true } = {}) {
    if (fitMap) loading.begin();
    let ring;
    try {
      ring = value.trim() ? parseWkt(value) : null;
      if (ring?.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90)) throw new Error('Polygon coordinates are outside valid longitude/latitude ranges.');
      syncing = true; draw.setMode('navigate'); draw.clear();
      if (ring) {
        const result = draw.addFeatures([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { mode: 'polygon' } }]);
        if (!result[0]?.valid) throw new Error('Invalid polygon boundary.');
      }
      write(value); message.textContent = ''; setMode(ring ? 'select' : 'navigate');
      updateNameLabels();
      if (fitMap) fit(ring || parentRing || referenceRings.flat());
      if (record) remember(value);
      else { history = [value]; position = 0; updateButtons(); }
      return true;
    } catch (error) {
      loading.fail();
      textarea.setCustomValidity(error.message); message.textContent = error.message;
      return false;
    } finally { syncing = false; }
  }
  function setParent(value) {
    try { parentRing = value ? parseWkt(value) : null; } catch { parentRing = null; }
    map.getSource('editor-parent').setData(parentRing ? { type: 'Feature', geometry: { type: 'Polygon', coordinates: [parentRing] }, properties: {} } : empty);
    if (!polygons().length) fit(parentRing);
  }
  function setReferencePolygons(records, { fitMap = true } = {}) {
    loading.begin();
    const features = records.flatMap(record => {
      if (!record.polygonDescription?.trim()) return [];
      try {
        const ring = parseWkt(record.polygonDescription);
        return [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: record.id, name: record.name || '', color: /^#[0-9a-f]{6}$/i.test(record.polygonColor) ? record.polygonColor : color, marketTypes: record.marketTypes || [], hasSections: Boolean(record.marketTypes?.length) } }];
      } catch { return []; }
    });
    referenceRings = features.map(feature => feature.geometry.coordinates[0]);
    referenceFeatures = features;
    referenceSections = features.flatMap(feature=>splitMarketSections(feature.geometry.coordinates,feature.properties.marketTypes));
    map.getSource('editor-reference').setData({ type: 'FeatureCollection', features });
    updateNameLabels();
    if (fitMap) fit([...(parentRing || []), ...referenceRings.flat(), ...(polygons()[0]?.geometry.coordinates[0] || [])]);
  }
  draw.on('change', () => { updateButtons(); clearTimeout(timer); timer = setTimeout(syncFromDraw, 100); });
  draw.on('finish', id => {
    if (!drawingModes.includes(mode)) return;
    const finished = draw.getSnapshotFeature(id);
    if (finished?.geometry.type === 'LineString') {
      const ring = finished.geometry.coordinates.map(point => [...point]);
      if (new Set(ring.map(point => point.join(','))).size < 3) {
        draw.removeFeatures([id]); message.textContent = 'A boundary needs at least three points.'; setMode('linestring'); return;
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push([...ring[0]]);
      setWkt(polygonToWkt({ geometry: { coordinates: [ring] } }), { record: true, fitMap: false }); return;
    }
    if (!finished || finished.geometry.type !== 'Polygon') return;
    setWkt(polygonToWkt(finished), { record: true, fitMap: false });
  });
  const onInput = () => {
    if (syncing) return;
    clearTimeout(timer); timer = setTimeout(() => setWkt(textarea.value, { record: true }), 350);
  };
  const onChange = () => { if (!syncing) { clearTimeout(timer); setWkt(textarea.value, { record: true }); } };
  textarea.addEventListener('input', onInput); textarea.addEventListener('change', onChange);
  if (labelStrips) nameInput?.addEventListener('input', updateNameLabels);
  function setFullView(enabled) {
    if (fullView === enabled) return;
    fullView = enabled;
    const button = toolbar.querySelector('[data-map-command="fullscreen"]');
    if (enabled) {
      previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
      placeholder = document.createComment('location-map-editor'); root.before(placeholder);
      document.body.appendChild(root); document.body.style.overflow = 'hidden';
      root.classList.add('location-map-fullview'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Boundary map editor');
    } else {
      placeholder?.replaceWith(root); placeholder = null;
      document.body.style.overflow = previousOverflow;
      root.classList.remove('location-map-fullview'); root.removeAttribute('role'); root.removeAttribute('aria-modal'); root.removeAttribute('aria-label');
    }
    const label = enabled ? 'Exit full view' : 'Full view map';
    button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-expanded', String(enabled));
    button.innerHTML = `<i data-lucide="${enabled ? 'Minimize2' : 'Maximize2'}"></i>`; createIcons({ icons });
    map.resize();
    if (enabled) button.focus(); else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  const onFullViewKey = event => {
    if (!fullView) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (event.type === 'keyup') setFullView(false); }
    if (event.type === 'keydown' && event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not(:disabled), canvas[tabindex]')];
      const index = focusable.indexOf(document.activeElement);
      if (index < 0 || (!event.shiftKey && index === focusable.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
      }
    }
  };
  document.addEventListener('keydown', onFullViewKey, true); document.addEventListener('keyup', onFullViewKey, true);
  const onCommand = event => {
    const button = event.target.closest('[data-map-command]');
    if (!button || button.disabled) return;
    const command = button.dataset.mapCommand;
    if (command === 'fullscreen') setFullView(!fullView);
    else if (command === 'finish') {
      map.getCanvas().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    } else if (command === 'undo' || command === 'redo') {
      const next = position + (command === 'undo' ? -1 : 1);
      const savedHistory = history;
      if (setWkt(history[next], { record: true })) { history = savedHistory; position = next; updateButtons(); }
    } else if (command === 'clear') setWkt('', { record: true });
    else if (command === 'fit') fit(polygons()[0]?.geometry.coordinates[0] || parentRing || referenceRings.flat());
    else { message.textContent = ''; setMode(command); }
  };
  toolbar.addEventListener('click', onCommand);
  function setColor(next) {
    if (!/^#[0-9a-f]{6}$/i.test(next)) return;
    color = next;
    const fillOpacity = currentMarketTypes.length ? 0 : 0.18;
    draw.setModeStyles('polygon', { fillColor: color, fillOpacity, outlineColor: color, outlineWidth: 2 });
    draw.setModeStyles('freehand', { fillColor: color, fillOpacity, outlineColor: color, outlineWidth: 2 });
    draw.setModeStyles('linestring', { lineStringColor: color, lineStringWidth: 2, coordinatePointColor: color });
    draw.setModeStyles('select', { selectedPolygonColor: color, selectedPolygonFillOpacity: fillOpacity, selectedPolygonOutlineColor: color, selectedPolygonOutlineWidth: 2, selectionPointColor: color, selectionPointWidth: 7, midPointColor: color });
    updateNameLabels();
  }
  function setMarketTypes(types) {
    currentMarketTypes = types.filter(type=>/^#[0-9a-f]{6}$/i.test(type.color));
    setColor(currentMarketTypes[0]?.color || '#dc2626');
  }
  map.resize(); setWkt(textarea.value);
  return { setWkt, setParent, setReferencePolygons, setColor, setMarketTypes, map, draw,
    destroy() { loading.destroy(); setFullView(false); document.removeEventListener('keydown', onFullViewKey, true); document.removeEventListener('keyup', onFullViewKey, true); clearTimeout(timer); textarea.removeEventListener('input', onInput); textarea.removeEventListener('change', onChange); nameInput?.removeEventListener('input', updateNameLabels); toolbar.removeEventListener('click', onCommand); draw.stop(); map.remove(); }
  };
}

window.ZigoPolygonEditor = { create, splitMarketSections, createMapLoading, renderMapControlIcons: () => createIcons({ icons: { Plus, Minus, Scan, Maximize2, Minimize2 } }) };
