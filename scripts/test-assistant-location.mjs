import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
let now = Date.now(), success, failure, tick, cleared = 0;
const listeners = new Map();
const context = { window: { addEventListener: (n, f) => listeners.set(n, f), removeEventListener: n => listeners.delete(n) },
  document: { addEventListener() {}, removeEventListener() {} }, crypto: { randomUUID },
  navigator: { geolocation: { watchPosition: (s, f) => { success = s; failure = f; return 1; }, clearWatch: () => cleared++, getCurrentPosition() {} } },
  Date: class extends Date { static now() { return now; } },
  setTimeout, clearTimeout, setInterval: f => { tick = f; return 1; }, clearInterval() {}, console };
vm.runInNewContext(fs.readFileSync('public/assistant-location.js', 'utf8'), context);
const api = context.window.ZigoAssistantLocation;
const position = (latitude = 28.6, timestamp = now) => ({ timestamp, coords: { latitude, longitude: 77.2, accuracy: 8, speed: 2, heading: 30 } });
const settle = () => new Promise(resolve => setImmediate(resolve));
assert.equal(api.normalize(position(91)), null);
assert.equal(api.normalize(position(28.6, now - 31000)), null);
assert.equal(api.normalize(position(28.6, now + 11000)), null);
assert.equal(api.normalize({ ...position(), coords: { ...position().coords, accuracy: 900 } }), null);
let uploads = [], states = [], deny = 0, rejectUpload = false, enabled = true;
const tracker = api.create({ publish: async p => { uploads.push(p); if (rejectUpload) throw Error('Network lost'); },
  shouldPublish: () => enabled, onStatus: s => states.push(s), onPermissionDenied: () => deny++ });
tracker.start(); tracker.start();
success(position()); await settle(); assert.equal(uploads.length, 1);
assert.equal(uploads[0].accuracy, 8); assert.equal(uploads[0].heading, 30);
now += 1000; success(position(28.61)); await settle(); assert.equal(uploads.length, 1, 'Moving GPS throttled');
now += 5000; tick(); await settle(); assert.equal(uploads.length, 2);
success(position(28.59, now - 10000)); await settle(); assert.equal(uploads.length, 2, 'Out of order readings ignored');
rejectUpload = true; now += 6000; success(position(28.62)); await settle();
assert.equal(states.at(-1), 'connection_lost'); assert.equal(tracker.active, true);
rejectUpload = false; now += 6000; tick(); await settle(); assert.equal(states.at(-1), 'live');
now += 31000; tick(); assert.equal(states.at(-1), 'stale');
failure({ code: 3 }); assert.equal(tracker.active, true, 'GPS timeout is recoverable');
failure({ code: 1 }); assert.equal(tracker.active, false); assert.equal(deny, 1); assert.equal(cleared, 1);
const before = uploads.length; success(position()); await settle(); assert.equal(uploads.length, before, 'Stopped callbacks cannot publish');
let nativeSession;
context.window.ZigoNativeLocation = { start: json => { nativeSession = JSON.parse(json).sessionId; }, stop() {} };
enabled = false; tracker.start();
assert.equal(tracker.receive('wrong-session', position()), false);
assert.equal(tracker.receive(nativeSession, position()), true);
await settle(); assert.equal(uploads.length, before, 'GPS acquisition does not mark an assistant online');
enabled = true; now += 1; tracker.receive(nativeSession, position()); await settle(); assert.equal(uploads.length, before + 1);
tracker.stop(); assert.equal(tracker.receive(nativeSession, position()), false);
console.log('GPS validation, throttling, ordering, reconnect, stale status, permissions, cleanup and native session tests passed.');
