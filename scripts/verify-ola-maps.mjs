import "dotenv/config";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { pool } from "../dist/db/pool.js";
import { requestOlaJson, olaBrowserConfig } from "../dist/modules/maps/olaMaps.service.js";

const server = createApp().listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const config = olaBrowserConfig();
const get = async (path) => {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `Map resource failed: ${path}`);
  return response;
};
try {
  assert.equal(config.olaMapsApiKey, "server-managed");
  const style = await (await get(config.olaMapsStyleUrl)).json();
  assert.ok(style.layers.length);
  assert.ok(!style.layers.some((layer) => layer['source-layer'] === '3d_model'));
  assert.ok(!JSON.stringify(style).includes(process.env.OLA_MAPS_CLIENT_SECRET));
  assert.ok(!JSON.stringify(style).includes(process.env.OLA_MAPS_API_KEY));
  const sources = [];
  for (const source of Object.values(style.sources)) {
    if (source.url) sources.push(await (await get(source.url)).json());
    else sources.push(source);
  }
  const z = 12;
  const x = Math.floor((77.2167 + 180) / 360 * 2 ** z);
  const lat = 28.6315 * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * 2 ** z);
  const tileTemplate = sources.flatMap((source) => source.tiles || [])[0];
  assert.ok(tileTemplate, "Style has a tile source");
  const tile = tileTemplate.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  assert.ok((await (await get(tile)).arrayBuffer()).byteLength > 0);
  if (typeof style.sprite === "string") {
    await get(`${style.sprite}.json`);
    await get(`${style.sprite}.png`);
  }
  if (style.glyphs) {
    const layer = style.layers.find((item) => Array.isArray(item.layout?.["text-font"]) && item.layout["text-font"].length > 0 && item.layout["text-font"].every((font) => typeof font === "string"));
    if (layer) await get(style.glyphs.replace("{fontstack}", encodeURIComponent(layer.layout["text-font"].join(","))).replace("{range}", "0-255"));
  }
  const raster = await get(config.olaMapsRasterTileUrl.replace("{z}", z).replace("{x}", x).replace("{y}", y));
  assert.ok(raster.headers.get("content-type").includes("image"));
  const places = await requestOlaJson("/places/v1/autocomplete", { input: "Connaught Place Delhi" });
  assert.ok(places.predictions?.length);
  const geocode = await requestOlaJson("/places/v1/geocode", { address: "Connaught Place Delhi" });
  assert.ok(geocode.geocodingResults?.length);
  const reverse = await requestOlaJson("/places/v1/reverse-geocode", { latlng: "28.6315,77.2167" });
  assert.ok(reverse.results?.length);
  for (const mode of ["driving", "two_wheeler"]) {
    const route = await requestOlaJson("/routing/v1/directions/basic", { origin: "28.6315,77.2167", destination: "28.6139,77.2090", mode }, { method: "POST" });
    assert.ok(route.routes?.length);
  }
  console.log("Ola SDK config, style, vector/raster tiles, sprites, glyphs, Places, Geocoding and Routing verified.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
