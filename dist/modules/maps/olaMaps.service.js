import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
const apiOrigin = "https://api.olamaps.io";
let accessToken = null;
let pendingToken = null;
export function olaMapsConfigured() {
    return Boolean(env.OLA_MAPS_API_KEY || (env.OLA_MAPS_CLIENT_ID && env.OLA_MAPS_CLIENT_SECRET));
}
export function olaBrowserConfig() {
    const base = env.APP_BASE_PATH.replace(/\/$/, "");
    return {
        // The SDK requires an authentication option; real credentials stay in the gateway.
        olaMapsApiKey: olaMapsConfigured() ? "server-managed" : null,
        olaMapsStyleUrl: `${base}/maps/style.json`,
        olaMapsRasterTileUrl: `${base}/maps/raster/{z}/{x}/{y}.png`,
        olaMapsSdkVersion: "1.4.0"
    };
}
async function getAccessToken() {
    if (accessToken && accessToken.expiresAt > Date.now() + 30000)
        return accessToken.value;
    if (pendingToken)
        return pendingToken;
    pendingToken = (async () => {
        const response = await fetch(env.OLA_MAPS_TOKEN_URL, {
            method: "POST", signal: AbortSignal.timeout(3500),
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.OLA_MAPS_CLIENT_ID, client_secret: env.OLA_MAPS_CLIENT_SECRET })
        });
        const payload = await response.json();
        if (!response.ok || !payload.access_token)
            throw new HttpError(502, "Ola Maps server credentials were rejected.");
        accessToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(1, Number(payload.expires_in) || 300) * 1000 };
        return accessToken.value;
    })();
    try {
        return await pendingToken;
    }
    finally {
        pendingToken = null;
    }
}
async function waitForToken(signal) {
    signal.throwIfAborted();
    let onAbort = () => { };
    const aborted = new Promise((_resolve, reject) => { onAbort = () => reject(signal.reason); signal.addEventListener("abort", onAbort, { once: true }); });
    try {
        return await Promise.race([getAccessToken(), aborted]);
    }
    finally {
        signal.removeEventListener("abort", onAbort);
    }
}
export async function requestOlaResponse(path, parameters = {}, options = {}) {
    if (!olaMapsConfigured())
        throw new HttpError(503, "Ola Maps credentials are not configured.");
    if (!/^\/(places\/v1\/|routing\/v1\/|tiles\/)/.test(path) || path.includes("..") || path.includes("?") || path.includes("#"))
        throw new HttpError(400, "Unsupported map resource.");
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin)
        throw new HttpError(400, "Unsupported map resource.");
    for (const [key, value] of Object.entries(parameters))
        if (!["api_key", "access_token", "token"].includes(key))
            url.searchParams.set(key, value);
    const signal = AbortSignal.timeout(options.timeoutMs ?? 3500);
    try {
        const oauth = Boolean(env.OLA_MAPS_CLIENT_ID && env.OLA_MAPS_CLIENT_SECRET);
        let token = oauth ? await waitForToken(signal) : null;
        if (!token)
            url.searchParams.set("api_key", env.OLA_MAPS_API_KEY);
        const headers = { "X-Request-Id": randomUUID() };
        if (env.OLA_MAPS_REQUEST_ORIGIN) {
            headers.Origin = new URL(env.OLA_MAPS_REQUEST_ORIGIN).origin;
            headers.Referer = `${headers.Origin}/`;
        }
        const send = () => fetch(url, { method: options.method ?? "GET", signal, redirect: "error", headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        // Retry transient tile failures within the original deadline, never writes or authorization failures.
        const sendTile = async () => {
            const attempts = path.startsWith("/tiles/") && (options.method ?? "GET") === "GET" ? 3 : 1;
            for (let attempt = 0;; attempt++) {
                try {
                    const result = await send();
                    if (![500, 502, 503, 504].includes(result.status) || attempt + 1 >= attempts)
                        return result;
                    await result.body?.cancel();
                }
                catch (error) {
                    if (signal.aborted || attempt + 1 >= attempts)
                        throw error;
                }
                await new Promise((resolve, reject) => {
                    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
                    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 150 * (attempt + 1));
                    signal.addEventListener("abort", onAbort, { once: true });
                    if (signal.aborted) {
                        signal.removeEventListener("abort", onAbort);
                        onAbort();
                    }
                });
            }
        };
        let response = await sendTile();
        if (response.status === 401 && token) {
            await response.body?.cancel();
            accessToken = null;
            token = await waitForToken(signal);
            response = await sendTile();
        }
        if (!response.ok) {
            await response.body?.cancel();
            const message = response.status === 429 ? "Ola Maps request limit reached. Please try again shortly."
                : [401, 403].includes(response.status) ? "Ola Maps credentials or domain permissions were rejected."
                    : "Ola Maps could not load this resource. Please try again.";
            throw new HttpError(response.status === 429 ? 429 : 502, message);
        }
        return response;
    }
    catch (error) {
        if (error instanceof HttpError)
            throw error;
        throw new HttpError(signal.aborted ? 504 : 502, signal.aborted ? "Ola Maps did not respond in time." : "Ola Maps is temporarily unavailable.");
    }
}
export async function requestOlaJson(path, parameters = {}, options = {}) {
    const response = await requestOlaResponse(path, parameters, options);
    try {
        return await response.json();
    }
    catch {
        throw new HttpError(502, "Ola Maps returned an invalid response.");
    }
}
