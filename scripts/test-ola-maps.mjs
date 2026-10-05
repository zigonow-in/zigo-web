import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import { notFoundHandler } from '../dist/http/errors.js';
process.env.OLA_MAPS_CLIENT_ID = 'test-client';
process.env.OLA_MAPS_CLIENT_SECRET = 'test-secret';
process.env.OLA_MAPS_API_KEY = 'test-key';
const { requestOlaJson, olaBrowserConfig } = await import('../dist/modules/maps/olaMaps.service.js');
const { rewriteMapAssetUrls, mapsRouter } = await import('../dist/modules/maps/maps.routes.js');
const originalFetch = globalThis.fetch;
let tokens = 0;
let calls = 0;
let rejectOnce = false;
let status = 200;
let brokenBody = false;
let temporaryFailures = 0;
let networkFailures = 0;
let server;
globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.href.includes('openid-connect/token')) {
    tokens++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ access_token: `test-token-${tokens}`, expires_in: 300 });
  }
  calls++;
  assert.equal(url.origin, 'https://api.olamaps.io');
  assert.equal(url.searchParams.has('api_key'), false);
  assert.equal(url.searchParams.has('access_token'), false);
  assert.match(options.headers.Authorization, /^Bearer test-token-/);
  if (networkFailures-- > 0) throw new TypeError('fetch failed');
  if (temporaryFailures-- > 0) return Response.json({}, { status: 502 });
  if (rejectOnce) { rejectOnce = false; return Response.json({}, { status: 401 }); }
  if (status === 204) return new Response(null, { status: 204 });
  if (brokenBody) return new Response(new ReadableStream({ start(controller) { controller.error(new Error('upstream disconnected')); } }), { headers: { 'content-type': 'application/x-protobuf' } });
  return Response.json({ ok: true }, { status });
};
try {
  assert.equal(olaBrowserConfig().olaMapsApiKey, 'server-managed');
  await Promise.all(Array.from({ length: 12 }, () => requestOlaJson('/places/v1/geocode', { api_key: 'injected', access_token: 'injected' })));
  assert.equal(tokens, 1, 'Concurrent requests share one OAuth refresh');
  assert.equal(calls, 12);
  rejectOnce = true;
  await requestOlaJson('/places/v1/geocode');
  assert.equal(tokens, 2, 'HTTP 401 refreshes the token once');
  status = 403;
  await assert.rejects(requestOlaJson('/places/v1/geocode'), error => error.statusCode === 502 && !error.message.includes('test-secret'));
  for (const path of ['https://evil.example/tiles/x', '/tiles/../secrets', '/places/v10/geocode', '/tiles/x?api_key=x']) {
    await assert.rejects(requestOlaJson(path));
  }
  const rewritten = rewriteMapAssetUrls({ tiles: ['https://api.olamaps.io/tiles/vector/v1/{z}/{x}/{y}.pbf?api_key=test-key'] }, '/admin/maps');
  assert.deepEqual(rewritten, { tiles: ['/admin/maps/assets/tiles/vector/v1/{z}/{x}/{y}.pbf'] });
  const app = express(); app.use('/admin/maps', mapsRouter); app.use(notFoundHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/admin/maps/assets/tiles/vector/v1/data/vectordata/12/2926`;
  status = 200;
  temporaryFailures = 2;
  const beforeTransient = calls;
  assert.equal((await originalFetch(`${base}/1700.pbf`)).status, 200);
  assert.equal(calls, beforeTransient + 3, 'Transient 502 tiles recover with bounded retries');
  networkFailures = 1;
  assert.equal((await originalFetch(`${base}/1701.pbf`)).status, 200, 'Network failures recover');
  status = 503;
  const beforePermanent = calls;
  assert.equal((await originalFetch(`${base}/1702.pbf`)).status, 502);
  assert.equal(calls, beforePermanent + 3, 'Persistent failures stop after three attempts');
  status = 403;
  const beforeForbidden = calls;
  assert.equal((await originalFetch(`${base}/1703.pbf`)).status, 502);
  assert.equal(calls, beforeForbidden + 1, 'Permission failures are not retried');
  status = 204;
  const beforeEmpty = calls;
  for (let i = 0; i < 2; i++) {
    const response = await originalFetch(`${base}/1710.pbf`);
    assert.equal(response.status, 204, 'Empty provider tile is not an internal server error');
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
  assert.equal(calls, beforeEmpty + 1, 'Empty tiles are cached');
  status = 200; brokenBody = true;
  const interrupted = await originalFetch(`${base}/1711.pbf`);
  assert.equal(interrupted.status, 502, 'Interrupted body is a controlled upstream error');
  brokenBody = false;
  const recovered = await originalFetch(`${base}/1711.pbf`);
  assert.equal(recovered.status, 200, 'A failed tile can be retried');
  console.log('Ola token coalescing, refresh, credential isolation, path validation and asset rewriting passed.');
  console.log('Empty tile, cache, interrupted response and recovery regression tests passed.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  globalThis.fetch = originalFetch;
}
