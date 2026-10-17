import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

let now = Date.now();
let success;
let failure;
let tick;
let cleared = 0;
let watchStarts = 0;
let timeoutSequence = 0;
const listeners = new Map();
const timeouts = new Map();
const setTestTimeout = (callback, delay = 0) => {
  const id = ++timeoutSequence;
  timeouts.set(id, { callback, delay });
  return id;
};
const clearTestTimeout = (id) => timeouts.delete(id);
const runTimeoutsThrough = async (maximumDelay) => {
  const runnable = [...timeouts.entries()].filter(([, timer]) => timer.delay <= maximumDelay);
  for (const [id, timer] of runnable) {
    timeouts.delete(id);
    timer.callback();
  }
  await new Promise((resolve) => setImmediate(resolve));
};

const context = {
  window: {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name)
  },
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
  crypto: { randomUUID },
  navigator: {
    geolocation: {
      watchPosition: (onSuccess, onFailure) => { watchStarts++; success = onSuccess; failure = onFailure; return watchStarts; },
      clearWatch: () => { cleared++; },
      getCurrentPosition() {}
    }
  },
  Date: class extends Date { static now() { return now; } },
  setTimeout: setTestTimeout,
  clearTimeout: clearTestTimeout,
  setInterval: (callback) => { tick = callback; return 1; },
  clearInterval() {},
  Math,
  console
};

vm.runInNewContext(fs.readFileSync("public/assistant-location.js", "utf8"), context);
const api = context.window.ZigoAssistantLocation;
const position = (latitude = 28.6, timestamp = now) => ({
  timestamp,
  coords: { latitude, longitude: 77.2, accuracy: 8, speed: 2, heading: 30 }
});
const settle = () => new Promise((resolve) => setImmediate(resolve));

assert.equal(api.normalize(position(91)), null);
assert.equal(api.normalize(position(28.6, now - 31000)), null);
assert.equal(api.normalize(position(28.6, now + 11000)), null);
assert.equal(api.normalize({ ...position(), coords: { ...position().coords, accuracy: 900 } }), null);
assert.equal(api.normalize({ capturedAt: new Date(now).toISOString(), latitude: "28.6", longitude: "77.2", accuracy: "8" }).latitude, 28.6);

const uploads = [];
const states = [];
let denied = 0;
let rejectUpload = false;
let enabled = true;
const tracker = api.create({
  publish: async (point) => { uploads.push(point); if (rejectUpload) throw new Error("Network lost"); },
  shouldPublish: () => enabled,
  onStatus: (status) => states.push(status),
  onPermissionDenied: () => { denied++; }
});

tracker.start();
tracker.start();
success(position());
await settle();
assert.equal(uploads.length, 1);
assert.equal(uploads[0].accuracy, 8);
assert.equal(uploads[0].heading, 30);

now += 1000;
success(position(28.61));
await settle();
assert.equal(uploads.length, 1, "Moving GPS is throttled to the upload interval");
now += 9000;
tick();
await settle();
assert.equal(uploads.length, 2);

success(position(28.59, now - 10000));
await settle();
assert.equal(uploads.length, 2, "Out-of-order readings are ignored");

rejectUpload = true;
now += 10000;
success(position(28.62));
await settle();
assert.equal(states.at(-1), "connection_lost");
assert.equal(tracker.active, true);
rejectUpload = false;
now += 2000;
await runTimeoutsThrough(2000);
assert.equal(states.at(-1), "live");
assert.equal(uploads.length, 4, "A failed upload is retried without waiting for a page refresh");

now += 31000;
tick();
assert.equal(states.at(-1), "stale");
failure({ code: 3 });
assert.equal(tracker.active, true, "GPS timeout is recoverable");

const staleWatchSuccess = success;
failure({ code: 1 });
assert.equal(tracker.active, true, "Permission failure keeps the session recoverable");
assert.equal(denied, 1);
assert.equal(cleared, 1);
const beforeLateCallback = uploads.length;
staleWatchSuccess(position(28.7));
await settle();
assert.equal(uploads.length, beforeLateCallback, "A queued callback from a cleared watch cannot publish");

const recovery = tracker.freshPosition();
const recoveredWatchSuccess = success;
now += 1;
recoveredWatchSuccess(position(28.63));
assert.equal((await recovery).latitude, 28.63);
assert.equal(tracker.active, true);

tracker.stop();
const beforeStoppedCallback = uploads.length;
recoveredWatchSuccess(position(28.64));
await settle();
assert.equal(uploads.length, beforeStoppedCallback, "Stopped callbacks cannot publish");

let nativeSession;
context.window.ZigoNativeLocation = {
  start: (json) => { nativeSession = JSON.parse(json).sessionId; },
  stop() {}
};
enabled = false;
tracker.start();
assert.equal(tracker.receive("wrong-session", position()), false);
assert.equal(tracker.receive(nativeSession, position()), true);
await settle();
assert.equal(uploads.length, beforeStoppedCallback, "GPS acquisition does not mark an assistant online");
enabled = true;
now += 1;
tracker.receive(nativeSession, position());
await settle();
assert.equal(uploads.length, beforeStoppedCallback + 1);
tracker.stop();
assert.equal(tracker.receive(nativeSession, position()), false);

const watchesBeforeFallback = watchStarts;
tracker.start();
await runTimeoutsThrough(2500);
assert.equal(watchStarts, watchesBeforeFallback + 1, "A silent native bridge falls back to browser geolocation");
now += 1;
success(position(28.65));
await settle();
assert.equal(tracker.latest.latitude, 28.65);
tracker.stop();

const deniedBeforeNativeRecovery = denied;
tracker.start();
await runTimeoutsThrough(2500);
failure({ code: 1 });
assert.equal(denied, deniedBeforeNativeRecovery, "Browser permission failure does not override an active native bridge");
now += 1;
assert.equal(tracker.receive(nativeSession, position(28.66)), true);
await settle();
assert.equal(tracker.latest.latitude, 28.66);
tracker.stop();

console.log("Assistant GPS session, ordering, throttling, retry, stale state, permission recovery, native fallback and watch isolation tests passed.");
