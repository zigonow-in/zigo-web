import { createIcons, Plus, Minus, Scan, LocateFixed, Maximize, Motorbike, CornerUpLeft, CornerUpRight, ArrowUp, RotateCcw, Flag } from 'lucide';
import { navigationProgress, metersBetween } from './navigation-progress.js';
(() => {
  const instances = new Set();
  const point = p => p && p.latitude != null && p.longitude != null && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    && Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180 ? [Number(p.longitude), Number(p.latitude)] : null;
  const empty = () => ({ type: 'FeatureCollection', features: [] });
  async function create(container, initial = {}) {
    const loading = document.createElement('div'); loading.className = 'zigo-live-map-status'; loading.textContent = 'Loading map...'; container.append(loading);
    await window.ZigoMaps.loadSdk();
    if (!container.isConnected) return null;
    const sdk = new window.OlaMaps({ apiKey: 'server-managed' });
    const map = await sdk.init({ container, style: window.ZigoMaps.styleUrl, transformRequest: window.ZigoMaps.transformRequest,
      center: point(initial.assistantLocation) || point(initial.destinationLocation) || [77.2167, 28.6315], zoom: 14 });
    let destroyed = false, ready = false, follow = initial.followLocation !== false, route = initial, fitted = false, animation = 0, displayed = null, latestStamp = 0;
    const navigation = initial.mode === 'navigation';
    let rider = null, lastPosition = null, riderHeading = 0;
    const guidance = document.createElement('div'); guidance.className = 'zigo-navigation-guidance';
    guidance.innerHTML = '<span data-navigation-turn></span><div><strong data-navigation-distance></strong><p data-navigation-instruction></p></div>';
    const trip = document.createElement('div'); trip.className = 'zigo-navigation-trip';
    trip.innerHTML = '<b data-navigation-eta></b><span data-navigation-remaining></span><button type="button" hidden>Next stop</button>';
    trip.querySelector('button').onclick = () => initial.onNextStop?.();
    if (navigation) { container.classList.add('is-navigation'); container.append(guidance, trip); }
    if (!container.isConnected) { map.remove(); return null; }
    const controls = document.createElement('div'); controls.className = 'zigo-live-map-controls';
    for (const [name, label, icon] of [['zoom-in', 'Zoom in', 'plus'], ['zoom-out', 'Zoom out', 'minus'], ['focus', 'Fit route', 'scan'], ['follow', 'Follow assistant', 'locate-fixed'], ['fullscreen', 'Fullscreen map', 'maximize']]) {
      const button = document.createElement('button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
      button.innerHTML = `<i data-lucide="${icon}"></i>`;
      if (name === 'follow') { button.setAttribute('aria-pressed', String(follow)); if (initial.mode === 'location') button.hidden = true; }
      button.onclick = () => {
        if (name === 'zoom-in') map.zoomIn();
        if (name === 'zoom-out') map.zoomOut();
        if (name === 'focus') fit();
        if (name === 'follow') { follow = !follow; button.setAttribute('aria-pressed', String(follow)); if (follow && displayed) followRider(displayed); }
        if (name === 'fullscreen') {
          container.classList.toggle('is-fullscreen'); map.resize(); fit();
        }
      };
      controls.append(button);
    }
    container.append(controls);
    createIcons({ icons: { Plus, Minus, Scan, LocateFixed, Maximize }, root: controls });
    function followRider(position) {
      map.easeTo({ center: position, ...(navigation ? { zoom: 17, pitch: 45, bearing: riderHeading, padding: { top: 110, bottom: 100, left: 20, right: 20 } } : {}), duration: 700 });
    }
    const meters = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value / 10) * 10} m`;
    function guide(path, target) {
      if (!navigation) return;
      const progress = navigationProgress(path, target, route.routeSteps || [], route.assistantLocation?.accuracy);
      const fresh = Date.now() - Date.parse(route.assistantLocation?.capturedAt || '') <= 90000;
      const accurate = route.assistantLocation?.accuracy != null && Number(route.assistantLocation.accuracy) <= 50;
      const nearby = target && point(route.stopLocations?.[0]);
      const reached = progress && nearby && metersBetween(nearby, target) <= 30 && accurate && fresh;
      const arrived = reached && (route.stopLocations || []).length <= 1;
      const icon = arrived ? 'flag' : /left/i.test(progress?.step?.maneuver || '') ? 'corner-up-left' : /right/i.test(progress?.step?.maneuver || '') ? 'corner-up-right' : /uturn|u-turn/i.test(progress?.step?.maneuver || '') ? 'rotate-ccw' : 'arrow-up';
      guidance.querySelector('[data-navigation-turn]').innerHTML = `<i data-lucide="${icon}"></i>`;
      createIcons({ icons: { CornerUpLeft, CornerUpRight, ArrowUp, RotateCcw, Flag }, root: guidance });
      guidance.querySelector('[data-navigation-distance]').textContent = !fresh ? 'GPS unavailable' : !accurate ? 'Low GPS accuracy' : arrived ? 'Arrived' : reached ? 'Stop reached' : progress?.offRoute ? 'Off route' : progress ? meters(progress.turnDistance) : 'Finding route';
      const instruction = new DOMParser().parseFromString(String(progress?.step?.instruction || ''), 'text/html').body.textContent;
      guidance.querySelector('[data-navigation-instruction]').textContent = !fresh || !accurate ? 'Waiting for an accurate location' : reached ? arrived ? 'Destination reached' : 'Continue when ready' : progress?.offRoute ? 'Updating route from your location' : instruction || 'Follow the highlighted route';
      trip.querySelector('[data-navigation-eta]').textContent = route.etaMinutes ? `${route.etaMinutes} min` : 'Bike navigation';
      trip.querySelector('[data-navigation-remaining]').textContent = progress ? `${meters(progress.remaining)} remaining` : 'Route pending';
      trip.querySelector('button').hidden = !(reached && !arrived && initial.onNextStop);
      if (progress?.offRoute && fresh && accurate) initial.onOffRoute?.();
      if (target) {
        const deviceHeading = route.assistantLocation?.heading;
        if (deviceHeading != null && Number.isFinite(Number(deviceHeading))) riderHeading = Number(deviceHeading);
        else if (lastPosition && lastPosition.some((value, index) => Math.abs(value - target[index]) > 0.00002)) riderHeading = progress?.heading || riderHeading;
        lastPosition = target;
      }
    }
    function fit() {
      const points = [point(route.assistantLocation), ...((route.stopLocations || []).map(point)), ...((route.routePath || route.routePolyline || []).map(point)), point(route.destinationLocation)].filter(Boolean);
      if (!points.length) return;
      if (points.length === 1) map.easeTo({ center: points[0], zoom: 15, duration: 450 });
      else map.fitBounds([[Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]], { padding: 48, maxZoom: 16, duration: 450 });
    }
    function draw() {
      if (!ready || destroyed) return;
      const path = (route.routePath || route.routePolyline || []).map(point).filter(Boolean);
      map.getSource('tracking-route').setData(path.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } } : empty());
      const stops = (route.stopLocations || []).map(point).filter(Boolean);
      const destination = point(route.destinationLocation);
      if (destination && !stops.some(p => p[0] === destination[0] && p[1] === destination[1])) stops.push(destination);
      map.getSource('tracking-stops').setData({ type: 'FeatureCollection', features: stops.map((p, i) => ({ type: 'Feature', properties: { label: String(i + 1) }, geometry: { type: 'Point', coordinates: p } })) });
      const target = point(route.assistantLocation);
      guide(path, target);
      if (target) {
        cancelAnimationFrame(animation);
        const from = displayed || target, started = performance.now();
        const animate = now => {
          if (destroyed) return;
          const t = Math.min(1, (now - started) / 700);
          displayed = [from[0] + (target[0] - from[0]) * t, from[1] + (target[1] - from[1]) * t];
          map.getSource('tracking-assistant').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: displayed } });
          if (rider) { rider.getElement().hidden = false; rider.setLngLat(displayed).setRotation(riderHeading); }
          if (t < 1) animation = requestAnimationFrame(animate);
        };
        animation = requestAnimationFrame(animate);
        if (follow && fitted) followRider(target);
      }
      if (!fitted && (target || stops.length)) { if (navigation && target && follow) followRider(target); else fit(); fitted = true; }
    }
    function update(next) {
      const stamp = Date.parse(next.assistantLocation?.capturedAt || '');
      if (Number.isFinite(stamp) && stamp < latestStamp) return;
      if (Number.isFinite(stamp)) latestStamp = stamp;
      route = next; draw(); refreshStatus();
    }
    function refreshStatus() {
      if (!ready) return;
      if (navigation) guide((route.routePath || route.routePolyline || []).map(point).filter(Boolean), point(route.assistantLocation));
      if (route.mode === 'location') { loading.textContent = 'Selected location'; loading.dataset.state = 'location'; return; }
      const timestamp = Date.parse(route.assistantLocation?.capturedAt || '');
      const fresh = Number.isFinite(timestamp) && Date.now() - timestamp <= 90000;
      loading.textContent = route.availabilityStatus === 'offline' ? 'Offline - Last location' : !point(route.assistantLocation) ? 'Waiting for GPS' : fresh ? 'Live GPS' : 'Location stale';
      loading.dataset.state = fresh ? 'live' : 'stale';
    }
    map.on('dragstart', e => { if (e.originalEvent) { follow = false; controls.querySelector('[aria-pressed]')?.setAttribute('aria-pressed', 'false'); } });
    map.on('load', () => {
      if (destroyed) return;
      for (const id of ['tracking-route', 'tracking-stops', 'tracking-assistant']) map.addSource(id, { type: 'geojson', data: empty() });
      map.addLayer({ id: 'tracking-road', type: 'line', source: 'tracking-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': navigation ? '#10aa5b' : '#075eea', 'line-width': navigation ? 7 : 5 } });
      map.addLayer({ id: 'tracking-stop-points', type: 'circle', source: 'tracking-stops', paint: { 'circle-radius': 12, 'circle-color': '#fff', 'circle-stroke-color': '#075eea', 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'tracking-stop-labels', type: 'symbol', source: 'tracking-stops', layout: { 'text-field': ['get', 'label'], 'text-size': 12 }, paint: { 'text-color': '#111827' } });
      map.addLayer({ id: 'tracking-gps', type: 'circle', source: 'tracking-assistant', paint: { 'circle-radius': navigation ? 0 : 9, 'circle-color': '#16a34a', 'circle-stroke-color': '#fff', 'circle-stroke-width': navigation ? 0 : 3 } });
      if (navigation) {
        const element = document.createElement('div'); element.className = 'zigo-navigation-rider'; element.setAttribute('aria-label', 'Assistant bike position');
        element.hidden = !point(route.assistantLocation);
        element.innerHTML = '<i data-lucide="motorbike"></i>'; createIcons({ icons: { Motorbike }, root: element });
        rider = sdk.addMarker({ element, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(point(route.assistantLocation) || [77.2167, 28.6315]).addTo(map);
      }
      ready = true; draw(); refreshStatus();
    });
    map.on('error', () => { if (!destroyed) loading.textContent = 'Map connection interrupted'; });
    const resize = new ResizeObserver(() => { if (!destroyed) map.resize(); }); resize.observe(container);
    const escape = e => {
      if (e.key === 'Escape' && container.classList.contains('is-fullscreen')) {
        e.preventDefault(); e.stopImmediatePropagation(); container.classList.remove('is-fullscreen'); map.resize(); fit();
      }
    };
    document.addEventListener('keydown', escape, true);
    const timer = setInterval(refreshStatus, 5000);
    const api = { update, fit, map, destroy() {
      if (destroyed) return; destroyed = true; clearInterval(timer); cancelAnimationFrame(animation); resize.disconnect(); document.removeEventListener('keydown', escape, true); rider?.remove(); map.remove(); controls.remove(); loading.remove(); guidance.remove(); trip.remove(); container.classList.remove('is-navigation'); instances.delete(api);
    }, container };
    instances.add(api); update(initial); return api;
  }
  new MutationObserver(() => { for (const instance of instances) if (!instance.container.isConnected) instance.destroy(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.ZigoLiveMap = { create, metersBetween, destroyAll: () => { for (const instance of instances) instance.destroy(); } };
})();
