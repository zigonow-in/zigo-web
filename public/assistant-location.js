(() => {
  function normalize(position) {
    const c = position?.coords || position || {};
    const timestamp = Number(position?.timestamp || Date.parse(c.capturedAt || ''));
    if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180
      || !Number.isFinite(timestamp) || timestamp > Date.now() + 10000 || Date.now() - timestamp > 30000
      || (c.accuracy != null && (!Number.isFinite(c.accuracy) || c.accuracy < 0 || c.accuracy > 500))) return null;
    return { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy ?? null,
      speed: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
      heading: Number.isFinite(c.heading) && c.heading >= 0 && c.heading < 360 ? c.heading : null,
      capturedAt: new Date(timestamp).toISOString() };
  }
  function distance(a, b) {
    if (!a || !b) return Infinity;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function create({ publish, onPosition, onStatus, onPermissionDenied, shouldPublish = () => true }) {
    let running = false, generation = 0, watch = null, timer = null, busy = false, reading = false;
    let latest = null, sent = null, sentAt = 0, sessionId = null;
    const waiters = new Map();
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    const status = (value) => onStatus?.(value);
    const accept = (position) => {
      if (!running) return false;
      const point = normalize(position);
      if (!point || (latest && point.capturedAt <= latest.capturedAt)) return false;
      latest = point; for (const resolve of waiters.keys()) resolve(point); waiters.clear(); onPosition?.(point); void flush(); return true;
    };
    const failGps = (error) => {
      if (!running) return;
      status(error.code === 1 ? 'permission_denied' : error.code === 2 ? 'location_unavailable' : 'gps_timeout');
      if (error.code === 1) { stop(); onPermissionDenied?.(); }
    };
    async function flush() {
      if (!running || busy || !latest || !shouldPublish()) return;
      if (Date.now() - Date.parse(latest.capturedAt) > 30000) { status('stale'); return; }
      if (Date.now() - sentAt < 5000 || (distance(sent, latest) < 5 && Date.now() - sentAt < 20000)) return;
      if (sent && latest.capturedAt <= sent.capturedAt) return;
      const current = generation, point = latest;
      busy = true;
      try {
        await publish(point);
        if (current !== generation) return;
        sent = point; sentAt = Date.now(); status('live');
      } catch { if (current === generation) { sentAt = Date.now(); status('connection_lost'); } }
      finally { if (current === generation) busy = false; }
    }
    function read() {
      if (!running || reading || window.ZigoNativeLocation) return;
      if (!navigator.geolocation) { status('location_unavailable'); return; }
      const current = generation; reading = true;
      navigator.geolocation.getCurrentPosition(p => { if (current !== generation) return; reading = false; accept(p); },
        e => { if (current !== generation) return; reading = false; failGps(e); }, options);
    }
    function resume() { if (running) { read(); void flush(); } }
    function start() {
      if (running) return;
      running = true; generation++; sessionId = crypto.randomUUID(); status('acquiring');
      if (window.ZigoNativeLocation?.start) {
        try { window.ZigoNativeLocation.start(JSON.stringify({ sessionId, highAccuracy: true })); }
        catch { status('location_unavailable'); }
      } else if (navigator.geolocation) {
        const current = generation;
        watch = navigator.geolocation.watchPosition(p => { if (current === generation) accept(p); },
          e => { if (current === generation) failGps(e); }, options);
        read();
      } else status('location_unavailable');
      timer = setInterval(() => {
        if (!latest || Date.now() - Date.parse(latest.capturedAt) > 20000) read();
        if (!latest || Date.now() - Date.parse(latest.capturedAt) > 30000) status('stale');
        void flush();
      }, 5000);
      window.addEventListener('online', resume);
      document.addEventListener('visibilitychange', resume);
    }
    function stop() {
      running = false; generation++;
      for (const reject of waiters.values()) reject(new Error('Location tracking stopped.'));
      waiters.clear();
      if (watch != null) navigator.geolocation?.clearWatch(watch);
      if (timer) clearInterval(timer);
      try { window.ZigoNativeLocation?.stop?.(JSON.stringify({ sessionId })); } catch { /* Logout must not depend on the native bridge. */ }
      watch = timer = sessionId = null; latest = sent = null; sentAt = 0; busy = reading = false;
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume);
    }
    function freshPosition() {
      start();
      if (latest && Date.now() - Date.parse(latest.capturedAt) < 10000) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const done = p => { clearTimeout(timeout); resolve(p); };
        const timeout = setTimeout(() => { waiters.delete(done); reject(new Error('Unable to read fresh GPS. Check device location and permission.')); }, 15000);
        waiters.set(done, error => { clearTimeout(timeout); reject(error); }); read();
      });
    }
    return { start, stop, freshPosition, receive: (id, position) => running && id === sessionId && accept(position),
      receiveError: (id, error) => { if (!running || id !== sessionId || ![1, 2, 3].includes(error?.code)) return false; failGps(error); return true; },
      get active() { return running; } };
  }
  window.ZigoAssistantLocation = { create, normalize, distance };
})();
