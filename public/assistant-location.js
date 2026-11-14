(() => {
  const MAX_FIX_AGE_MS = 30000;
  const STALE_FIX_AGE_MS = 15000;
  const MAX_FUTURE_SKEW_MS = 10000;
  const MAX_ACCURACY_METERS = 500;
  const PUBLISH_INTERVAL_MS = 10000;
  const STATIONARY_HEARTBEAT_MS = 20000;
  const TRACKER_TICK_MS = 5000;

  function normalize(position) {
    const coords = position?.coords || position || {};
    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    const accuracy = coords.accuracy == null ? null : Number(coords.accuracy);
    const timestampValue = position?.timestamp ?? coords.capturedAt ?? coords.timestamp;
    const timestamp = typeof timestampValue === "number" ? timestampValue : Date.parse(String(timestampValue || ""));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
      || !Number.isFinite(timestamp) || timestamp > Date.now() + MAX_FUTURE_SKEW_MS || Date.now() - timestamp > MAX_FIX_AGE_MS
      || (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_ACCURACY_METERS))) return null;
    const speed = coords.speed == null ? null : Number(coords.speed);
    const heading = coords.heading == null ? null : Number(coords.heading);
    return {
      latitude,
      longitude,
      accuracy,
      speed: Number.isFinite(speed) && speed >= 0 ? speed : null,
      heading: Number.isFinite(heading) && heading >= 0 && heading < 360 ? heading : null,
      capturedAt: new Date(timestamp).toISOString()
    };
  }

  function distance(a, b) {
    if (!a || !b) return Infinity;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function create({ publish, onPosition, onStatus, onPermissionDenied, shouldPublish = () => true }) {
    let running = false;
    let generation = 0;
    let watchId = null;
    let watchToken = 0;
    let tickTimer = null;
    let uploadRetryTimer = null;
    let gpsRetryTimer = null;
    let nativeFallbackTimer = null;
    let publishBusy = false;
    let readRequestId = 0;
    let activeReadRequestId = 0;
    let latest = null;
    let sent = null;
    let sentAt = 0;
    let nextPublishAt = 0;
    let uploadRetryAttempt = 0;
    let gpsRetryAttempt = 0;
    let sessionId = null;
    let lastStatus = "";
    let permissionStatus = null;
    let permissionListener = null;
    let wakeLock = null;
    let browserFallbackActive = false;
    let parentMessageBound = false;
    const waiters = new Set();
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

    const setStatus = (value) => {
      if (lastStatus === value) return;
      lastStatus = value;
      onStatus?.(value);
    };

    const resolveWaiters = (point) => {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout);
        waiter.resolve(point);
      }
      waiters.clear();
    };

    const rejectWaiters = (error) => {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
      waiters.clear();
    };

    const clearBrowserWatch = () => {
      watchToken++;
      if (watchId != null) navigator.geolocation?.clearWatch(watchId);
      watchId = null;
    };

    const nativeBridgeAvailable = () => typeof window.ZigoNativeLocation?.start === "function";
    const commonNativeBridges = () => [window.ZigoAndroid, window.Android, window.ZigoNative].filter(Boolean);
    const commonNativeBridgeAvailable = () => commonNativeBridges().some((bridge) =>
      typeof bridge.postMessage === "function"
      || typeof bridge.getCurrentLocation === "function"
      || typeof bridge.requestCurrentLocation === "function"
      || typeof bridge.requestLocationPermission === "function"
      || typeof bridge.getLocation === "function"
    ) || typeof window.ReactNativeWebView?.postMessage === "function";
    const parentBridgeAvailable = () => Boolean(window.parent && window.parent !== window && typeof window.parent.postMessage === "function");
    const frameTargetOrigin = () => {
      try {
        const origin = new URL(document.referrer || "", window.location.href).origin;
        return origin && origin !== "null" ? origin : "*";
      } catch {
        return "*";
      }
    };
    const sendParentMessage = (type, payload = {}) => {
      if (!parentBridgeAvailable()) return false;
      try {
        window.parent.postMessage({ type, source: "zigo-portal", actor: "assistant", ...payload }, frameTargetOrigin());
        return true;
      } catch {
        return false;
      }
    };
    const parseNativeResult = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        try { return JSON.parse(value); } catch { return null; }
      }
      return typeof value === "object" ? value : null;
    };
    const nativePositionPayload = (value) => {
      const parsed = parseNativeResult(value);
      if (!parsed) return null;
      const data = parsed.data && typeof parsed.data === "object" ? { ...parsed.data, ...parsed } : parsed;
      const coords = data.coords || data.location?.coords || data.location || data;
      const latitude = Number(coords?.latitude ?? coords?.lat);
      const longitude = Number(coords?.longitude ?? coords?.lng ?? coords?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        ...data,
        timestamp: data.timestamp ?? data.capturedAt ?? Date.now(),
        coords: { ...coords, latitude, longitude }
      };
    };
    const sendCommonNativeMessage = (type, payload = {}) => {
      const message = { type, source: "zigo-portal", actor: "assistant", ...payload };
      const json = JSON.stringify(message);
      let sent = false;
      commonNativeBridges().forEach((bridge) => {
        try {
          const method = type === "zigo.location.getCurrent"
            ? (bridge.getCurrentLocation || bridge.requestCurrentLocation || bridge.requestLocationPermission || bridge.getLocation || bridge.postMessage)
            : type === "zigo.location.start"
              ? (bridge.startLocationTracking || bridge.startLocation || bridge.requestLocationPermission || bridge.postMessage)
              : (bridge.stopLocationTracking || bridge.stopLocation || bridge.postMessage);
          if (typeof method !== "function") return;
          const result = method.call(bridge, json);
          const position = nativePositionPayload(result);
          if (position) accept(position, "native");
          sent = true;
        } catch {
          // Try the next available WebView bridge.
        }
      });
      try {
        if (window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(json);
          sent = true;
        }
      } catch {
        // Optional bridge.
      }
      return sent;
    };
    const sendLocationBridgeMessage = (type, payload = {}) => {
      if (commonNativeBridgeAvailable() && sendCommonNativeMessage(type, payload)) return true;
      return sendParentMessage(type, payload);
    };
    const externalBridgeAvailable = () => nativeBridgeAvailable() || commonNativeBridgeAvailable() || parentBridgeAvailable();

    const clearNativeFallback = () => {
      if (nativeFallbackTimer) clearTimeout(nativeFallbackTimer);
      nativeFallbackTimer = null;
    };

    const accept = (position, source = "browser") => {
      if (!running) return false;
      const point = normalize(position);
      if (!point || (latest && point.capturedAt <= latest.capturedAt)) return false;
      if (source === "native") {
        clearNativeFallback();
        if (browserFallbackActive) {
          browserFallbackActive = false;
          clearBrowserWatch();
        }
      }
      latest = point;
      gpsRetryAttempt = 0;
      resolveWaiters(point);
      onPosition?.(point);
      void flush();
      return true;
    };

    const handleParentMessage = (event) => {
      if (!running) return;
      const fromParent = parentBridgeAvailable() && event.source === window.parent;
      const fromNativeWindow = commonNativeBridgeAvailable() && event.source === window;
      if (!fromParent && !fromNativeWindow) return;
      const data = typeof event.data === "string" ? (() => {
        try { return JSON.parse(event.data); } catch { return null; }
      })() : event.data;
      if (!data || typeof data !== "object") return;
      const type = String(data.type || "");
      if (!["zigo.location.result", "zigo.location.update", "zigo.location.position", "zigo.location.error"].includes(type)) return;
      const payload = data.position || data.location || data.data || data;
      const messageSessionId = String(data.sessionId || payload?.sessionId || data.requestId || payload?.requestId || "");
      if (!messageSessionId || messageSessionId !== sessionId) return;
      if (type === "zigo.location.error") {
        failGps(data.error || payload || data, "native");
        return;
      }
      accept(nativePositionPayload(payload), "native");
    };

    const bindParentBridge = () => {
      if ((!parentBridgeAvailable() && !commonNativeBridgeAvailable()) || parentMessageBound) return;
      window.addEventListener("message", handleParentMessage);
      parentMessageBound = true;
    };

    const unbindParentBridge = () => {
      if (!parentMessageBound) return;
      window.removeEventListener("message", handleParentMessage);
      parentMessageBound = false;
    };

    const requestExternalLocation = () => sendLocationBridgeMessage("zigo.location.getCurrent", {
      requestId: sessionId,
      sessionId,
      highAccuracy: true
    });

    const scheduleGpsRetry = () => {
      if (!running || gpsRetryTimer || (externalBridgeAvailable() && !browserFallbackActive)) return;
      const delay = Math.min(30000, 2000 * (2 ** Math.min(gpsRetryAttempt++, 4)));
      gpsRetryTimer = setTimeout(() => {
        gpsRetryTimer = null;
        if (!running || document.visibilityState === "hidden") return;
        ensureBrowserWatch();
        read(true);
      }, delay);
    };

    const enableBrowserFallback = () => {
      const latestAge = latest ? Date.now() - Date.parse(latest.capturedAt) : Infinity;
      if (!running || browserFallbackActive || latestAge <= 15000 || !navigator.geolocation) return;
      clearNativeFallback();
      browserFallbackActive = true;
      ensureBrowserWatch();
      read(true);
    };

    const scheduleNativeFallback = () => {
      const latestAge = latest ? Date.now() - Date.parse(latest.capturedAt) : Infinity;
      if (!running || browserFallbackActive || latestAge <= 15000 || nativeFallbackTimer || !externalBridgeAvailable() || !navigator.geolocation) return;
      nativeFallbackTimer = setTimeout(() => {
        nativeFallbackTimer = null;
        enableBrowserFallback();
      }, 2500);
    };

    const failGps = (error = {}, source = "browser") => {
      if (!running) return;
      const code = Number(error.code || 0);
      const permissionDenied = code === 1;
      setStatus(permissionDenied ? "permission_denied" : code === 2 ? "location_unavailable" : "gps_timeout");
      if (permissionDenied) {
        clearBrowserWatch();
        if (source === "browser" && nativeBridgeAvailable()) {
          browserFallbackActive = false;
          setStatus("acquiring");
          return;
        }
        rejectWaiters(new Error("Location permission is required to go online."));
        onPermissionDenied?.(error);
        return;
      }
      scheduleGpsRetry();
    };

    const scheduleUploadRetry = () => {
      if (!running || uploadRetryTimer) return;
      const delay = Math.min(30000, 2000 * (2 ** Math.min(uploadRetryAttempt++, 4)));
      nextPublishAt = Date.now() + delay;
      uploadRetryTimer = setTimeout(() => {
        uploadRetryTimer = null;
        if (!running) return;
        if (!latest || Date.now() - Date.parse(latest.capturedAt) > MAX_FIX_AGE_MS) read(true);
        void flush(true);
      }, delay);
    };

    const handleNetworkOffline = () => {
      if (!running) return;
      setStatus("connection_lost");
      scheduleUploadRetry();
    };

    async function flush(force = false) {
      if (!running || publishBusy || !latest || !shouldPublish()) return;
      if (navigator.onLine === false) {
        setStatus("connection_lost");
        scheduleUploadRetry();
        return;
      }
      const now = Date.now();
      if (now - Date.parse(latest.capturedAt) > MAX_FIX_AGE_MS) {
        setStatus("stale");
        return;
      }
      if (!force && now < nextPublishAt) return;
      if (!force && (now - sentAt < PUBLISH_INTERVAL_MS
        || (distance(sent, latest) < 5 && now - sentAt < STATIONARY_HEARTBEAT_MS))) return;
      if (sent && latest.capturedAt <= sent.capturedAt) return;
      const currentGeneration = generation;
      const point = latest;
      publishBusy = true;
      try {
        await publish(point);
        if (currentGeneration !== generation) return;
        sent = point;
        sentAt = Date.now();
        nextPublishAt = sentAt + PUBLISH_INTERVAL_MS;
        uploadRetryAttempt = 0;
        if (uploadRetryTimer) clearTimeout(uploadRetryTimer);
        uploadRetryTimer = null;
        setStatus("live");
      } catch {
        if (currentGeneration !== generation) return;
        setStatus("connection_lost");
        scheduleUploadRetry();
      } finally {
        if (currentGeneration === generation) publishBusy = false;
      }
    }

    function ensureBrowserWatch() {
      if (!running || watchId != null || (externalBridgeAvailable() && !browserFallbackActive) || !navigator.geolocation) return;
      const currentGeneration = generation;
      const currentWatchToken = ++watchToken;
      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => { if (currentGeneration === generation && currentWatchToken === watchToken) accept(position, "browser"); },
          (error) => { if (currentGeneration === generation && currentWatchToken === watchToken) failGps(error, "browser"); },
          options
        );
      } catch (error) {
        failGps(error);
      }
    }

    function read(force = false) {
      if (!running || (externalBridgeAvailable() && !browserFallbackActive)) {
        if (running && !browserFallbackActive) requestExternalLocation();
        return;
      }
      if (!navigator.geolocation) {
        setStatus("location_unavailable");
        return;
      }
      ensureBrowserWatch();
      if (activeReadRequestId && !force) return;
      const currentGeneration = generation;
      const currentReadRequestId = ++readRequestId;
      activeReadRequestId = currentReadRequestId;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (activeReadRequestId === currentReadRequestId) activeReadRequestId = 0;
          if (currentGeneration !== generation || currentReadRequestId !== readRequestId) return;
          accept(position, "browser");
        },
        (error) => {
          if (activeReadRequestId === currentReadRequestId) activeReadRequestId = 0;
          if (currentGeneration !== generation || currentReadRequestId !== readRequestId) return;
          failGps(error, "browser");
        },
        options
      );
    }

    function resume() {
      if (!running) return;
      if (document.visibilityState === "hidden") {
        releaseWakeLock();
        return;
      }
      if (navigator.onLine === false) {
        setStatus("connection_lost");
        return;
      }
      void acquireWakeLock();
      scheduleNativeFallback();
      ensureBrowserWatch();
      read(true);
      void flush(true);
    }

    function newSessionId() {
      return globalThis.crypto?.randomUUID?.()
        || `gps-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function bindPermissionChanges() {
      if (!navigator.permissions?.query) return;
      const currentGeneration = generation;
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (!running || currentGeneration !== generation) return;
        permissionStatus = result;
        permissionListener = () => {
          if (!running) return;
          if (result.state === "granted") resume();
          else if (result.state === "denied") failGps({ code: 1 }, "browser");
        };
        result.addEventListener?.("change", permissionListener);
      }).catch(() => {});
    }

    function unbindPermissionChanges() {
      permissionStatus?.removeEventListener?.("change", permissionListener);
      permissionStatus = permissionListener = null;
    }

    async function acquireWakeLock() {
      if (!running || wakeLock || document.visibilityState === "hidden" || !navigator.wakeLock?.request) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener?.("release", () => { wakeLock = null; });
      } catch {
        wakeLock = null;
      }
    }

    function releaseWakeLock() {
      const activeLock = wakeLock;
      wakeLock = null;
      void activeLock?.release?.().catch?.(() => {});
    }

    function start() {
      if (running) return;
      running = true;
      generation++;
      sessionId = newSessionId();
      lastStatus = "";
      browserFallbackActive = false;
      clearNativeFallback();
      setStatus("acquiring");
      bindParentBridge();
      if (nativeBridgeAvailable()) {
        try {
          window.ZigoNativeLocation.start(JSON.stringify({ sessionId, highAccuracy: true, minimumIntervalMs: PUBLISH_INTERVAL_MS }));
          scheduleNativeFallback();
        } catch {
          enableBrowserFallback();
        }
      } else if (externalBridgeAvailable()) {
        sendLocationBridgeMessage("zigo.location.start", { sessionId, highAccuracy: true, minimumIntervalMs: PUBLISH_INTERVAL_MS });
        requestExternalLocation();
        scheduleNativeFallback();
      } else if (navigator.geolocation) {
        ensureBrowserWatch();
      } else {
        setStatus("location_unavailable");
      }
      bindPermissionChanges();
      void acquireWakeLock();
      tickTimer = setInterval(() => {
        const age = latest ? Date.now() - Date.parse(latest.capturedAt) : Infinity;
        if (age > STALE_FIX_AGE_MS) {
          scheduleNativeFallback();
          read();
        }
        if (age > STALE_FIX_AGE_MS) setStatus("stale");
        void flush();
      }, TRACKER_TICK_MS);
      window.addEventListener("online", resume);
      window.addEventListener("offline", handleNetworkOffline);
      document.addEventListener("visibilitychange", resume);
    }

    function stop() {
      if (!running && !tickTimer && watchId == null) return;
      running = false;
      generation++;
      readRequestId++;
      activeReadRequestId = 0;
      rejectWaiters(new Error("Location tracking stopped."));
      clearBrowserWatch();
      if (tickTimer) clearInterval(tickTimer);
      if (uploadRetryTimer) clearTimeout(uploadRetryTimer);
      if (gpsRetryTimer) clearTimeout(gpsRetryTimer);
      clearNativeFallback();
      if (sessionId) sendLocationBridgeMessage("zigo.location.stop", { sessionId });
      unbindParentBridge();
      try {
        window.ZigoNativeLocation?.stop?.(JSON.stringify({ sessionId }));
      } catch {
        // Session cleanup must not depend on the native wrapper.
      }
      tickTimer = uploadRetryTimer = gpsRetryTimer = null;
      sessionId = null;
      latest = sent = null;
      sentAt = nextPublishAt = 0;
      uploadRetryAttempt = gpsRetryAttempt = 0;
      publishBusy = false;
      browserFallbackActive = false;
      unbindPermissionChanges();
      releaseWakeLock();
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", handleNetworkOffline);
      document.removeEventListener("visibilitychange", resume);
    }

    function freshPosition({ force = false } = {}) {
      start();
      if (!force && latest && Date.now() - Date.parse(latest.capturedAt) < 10000) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const waiter = { resolve, reject, timeout: null };
        waiter.timeout = setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error("Unable to read fresh GPS. Check device location and permission."));
        }, 15000);
        waiters.add(waiter);
        scheduleNativeFallback();
        ensureBrowserWatch();
        read(true);
      });
    }

    return {
      start,
      stop,
      freshPosition,
      receive: (id, position) => running && id === sessionId && accept(position, "native"),
      receiveError: (id, error) => {
        if (!running || id !== sessionId || ![1, 2, 3].includes(Number(error?.code))) return false;
        failGps(error, "native");
        return true;
      },
      get active() { return running; },
      get latest() { return latest ? { ...latest } : null; }
    };
  }

  window.ZigoAssistantLocation = { create, normalize, distance };
})();
