import { Router } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
import { rateLimit } from "../../http/rateLimit.js";
import { requestOlaResponse } from "./olaMaps.service.js";

export const mapsRouter = Router();
mapsRouter.use(rateLimit({ keyPrefix: "map-assets", windowMs: 60000, max: 600 }));
mapsRouter.use((req, _res, next) => {
  if (req.get("Sec-Fetch-Site") === "cross-site") return next(new HttpError(403, "Cross-site map asset requests are not allowed."));
  next();
});

type MapAsset = { body: Buffer; contentType: string; status: number; expiresAt: number; cacheSeconds: number };
const cache = new Map<string, MapAsset>();
const pending = new Map<string, Promise<MapAsset>>();
let cachedBytes = 0;

async function asset(path: string) {
  if (!path.startsWith("/tiles/") || path.includes("..") || path.includes("?") || path.includes("#")) throw new HttpError(400, "Unsupported map asset.");
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) { cache.delete(path); cache.set(path, cached); return cached; }
  if (cached) { cachedBytes -= cached.body.length; cache.delete(path); }
  if (pending.has(path)) return pending.get(path)!;
  if (pending.size >= 32) throw new HttpError(429, "Map is busy. Please try again shortly.");
  const promise = (async () => {
    const response = await requestOlaResponse(path, {}, { timeoutMs: 8000 });
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > 5 * 1024 * 1024) { await response.body?.cancel(); throw new HttpError(502, "Map asset is too large."); }
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      if (response.body) for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) throw new HttpError(502, "Map asset is too large.");
        chunks.push(chunk);
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new HttpError(timedOut ? 504 : 502, timedOut ? "Ola Maps did not respond in time." : "Ola Maps returned an incomplete map asset. Please try again.");
    }
    const control = response.headers.get("cache-control") || "";
    const maxAge = Number(control.match(/(?:^|,)\s*max-age=(\d+)/)?.[1] || 300);
    const cacheSeconds = /no-store|no-cache|private/i.test(control) ? 0 : Math.min(maxAge, 3600);
    const result = { body: Buffer.concat(chunks), contentType: response.headers.get("content-type") || "application/octet-stream", status: response.status, expiresAt: Date.now() + cacheSeconds * 1000, cacheSeconds };
    if (cacheSeconds > 0) {
      while (cache.size >= 256 || cachedBytes + result.body.length > 32 * 1024 * 1024) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        cachedBytes -= cache.get(oldest)!.body.length;
        cache.delete(oldest);
      }
      cache.set(path, result); cachedBytes += result.body.length;
    }
    return result;
  })();
  pending.set(path, promise);
  try { return await promise; }
  finally { pending.delete(path); }
}

export function rewriteMapAssetUrls(value: unknown, base: string): unknown {
  if (typeof value === "string" && /^https?:\/\/api\.olamaps\.io\//i.test(value)) {
    const url = new URL(value);
    if (url.pathname.startsWith("/tiles/")) return `${base}/assets${url.pathname.replace(/%7B/gi, "{").replace(/%7D/gi, "}")}`;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteMapAssetUrls(item, base));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteMapAssetUrls(item, base)]));
  return value;
}

mapsRouter.get("/style.json", async (req, res, next) => {
  try {
    const url = new URL(env.OLA_MAPS_STYLE_URL);
    if (url.origin !== "https://api.olamaps.io") throw new HttpError(503, "Configure an Ola Maps style URL.");
    const resource = await asset(url.pathname);
    res.setHeader("Cache-Control", `public, max-age=${Math.min(resource.cacheSeconds, 300)}`);
    const style = JSON.parse(resource.body.toString("utf8"));
    // Ola's shared style references an optional 3D source absent from its 2D tiles.
    style.layers = style.layers.filter((layer: Record<string, unknown>) => layer["source-layer"] !== "3d_model");
    res.json(rewriteMapAssetUrls(style, `${req.protocol}://${req.get("host")}${req.baseUrl}`));
  } catch (error) { next(error); }
});

mapsRouter.get<{ resource: string }>("/assets/:resource(*)", async (req, res, next) => {
  try {
    const path = `/${req.params.resource}`;
    if (!/\.(json|png|pbf|webp|jpg)$/i.test(path)) throw new HttpError(400, "Unsupported map asset format.");
    const resource = await asset(path);
    res.setHeader("Cache-Control", `public, max-age=${resource.cacheSeconds}`);
    if (resource.status === 204) { res.status(204).end(); return; }
    if (resource.contentType.includes("json")) res.json(rewriteMapAssetUrls(JSON.parse(resource.body.toString("utf8")), `${req.protocol}://${req.get("host")}${req.baseUrl}`));
    else res.type(resource.contentType).send(resource.body);
  } catch (error) { next(error); }
});

mapsRouter.get("/raster/:z/:x/:y.png", async (req, res, next) => {
  try {
    const values = [req.params.z, req.params.x, req.params.y];
    if (values.some((value) => !/^\d+$/.test(value))) throw new HttpError(400, "Invalid map tile.");
    const [z, x, y] = values.map(Number);
    if (z > 19 || x >= 2 ** z || y >= 2 ** z) throw new HttpError(400, "Invalid map tile.");
    const longitude = (column: number) => column / 2 ** z * 360 - 180;
    const latitude = (row: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / 2 ** z))) * 180 / Math.PI;
    const bounds = [longitude(x), latitude(y + 1), longitude(x + 1), latitude(y)].join(",");
    const resource = await asset(`/tiles/v1/styles/default-light-standard/static/${bounds}/256x256.png`);
    res.setHeader("Cache-Control", `public, max-age=${resource.cacheSeconds}`);
    res.type(resource.contentType).send(resource.body);
  } catch (error) { next(error); }
});
