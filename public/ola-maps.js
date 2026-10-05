(() => {
  const scriptUrl = document.currentScript.src;
  const base = new URL("./maps/", scriptUrl).pathname.replace(/\/$/, "");
  let sdkPromise = null;
  function loadSdk() {
    if (typeof window.OlaMaps === "function") return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const finish = (error) => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      };
      const timer = setTimeout(() => finish(new Error("Map loading timed out. Please try again.")), 10000);
      script.src = new URL("./assets/vendor/olamaps/1.4.0/olamaps-web-sdk.umd.js", scriptUrl).href;
      script.onload = () => finish(typeof window.OlaMaps === "function" ? null : new Error("Map SDK did not initialize."));
      script.onerror = () => finish(new Error("Unable to load the map. Please try again."));
      document.head.appendChild(script);
    }).catch((error) => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  const rasterTileUrl = (z, x, y) => `${base}/raster/${z}/${x}/${y}.png`;
  function rasterStyle() {
    return { version: 8,
      sources: { ola: { type: "raster", tiles: [rasterTileUrl("{z}", "{x}", "{y}")], tileSize: 256, attribution: '<a href="https://maps.olakrutrim.com/">Ola Maps</a> | <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' } },
      layers: [{ id: "ola-raster", type: "raster", source: "ola" }] };
  }
  const transformRequest = (url) => ({ url: new URL(url, window.location.href).href });
  window.ZigoMaps = { loadSdk, rasterStyle, rasterTileUrl, transformRequest, styleUrl: `${base}/style.json` };
})();
