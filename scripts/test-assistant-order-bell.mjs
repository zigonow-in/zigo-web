import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/portal.js', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('function assistantBroadcastDurationMs('), source.indexOf('function scheduleAssistantTaskRefresh('));
let plays = 0;
let blocked = false;
let pauses = 0;
let stopTimer = null;
const timerDelays = [];
const listeners = {};
class AudioMock {
  constructor(url) { assert.equal(url, '/assets/order-ring.mpeg'); }
  play() { plays++; return blocked ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); }
  pause() { pauses++; }
}
const context = vm.createContext({
  actor: 'assistant', state: { token: 'fixture' }, Audio: AudioMock, Date,
  assistantOrderAudio: null, assistantOrderAudioPending: false,
  assistantOrderAudioRinging: false, assistantOrderAudioStopTimer: null,
  assistantOrderRingAssignmentId: '', assistantOrderRingEventType: '',
  assistantOrderAlertedIds: new Set(), withBasePath: value => value,
  portalServerNowMs: () => Date.now(),
  setTimeout: (callback, delay) => { timerDelays.push(delay); stopTimer = callback; return 1; },
  clearTimeout: () => { stopTimer = null; },
  document: { addEventListener: (name, listener) => { listeners[name] = listener; } }
});
vm.runInContext(section, context);
context.alertAssistantRealtimeOrder('booking.offered', { assignmentId: 'realtime-offer', assignmentStatus: 'offered', expiresAt: new Date(Date.now() + 30000).toISOString() });
await Promise.resolve();
assert.equal(plays, 1, 'Realtime broadcast must ring before task refresh');
assert.ok(timerDelays.at(-1) > 29000 && timerDelays.at(-1) <= 30000, 'Offer bell must stop when its server expiry is reached');
assert.equal(context.assistantOrderAudio.loop, true, 'Order bell must repeat when the sound finishes');
assert.equal(context.assistantOrderAudioRinging, true);
context.alertAssistantRealtimeOrder('booking.assigned', { assignmentId: 'realtime-offer' });
assert.equal(plays, 1, 'The accepted event for the same assignment must not ring twice');
context.stopAssistantOrderBellForRealtime('booking.assigned', { assignmentId: 'realtime-offer', assignmentStatus: 'accepted' });
assert.equal(context.assistantOrderAudioRinging, false, 'Accepting a broadcast must stop its repeating bell');
context.alertAssistantRealtimeOrder('booking.assigned', { assignmentId: 'realtime-confirm', broadcastTimeSeconds: 45 });
await Promise.resolve();
assert.equal(plays, 1, 'A directly confirmed Pending booking must stay silent');
const offer = { assignmentId: 'offer', assignmentStatus: 'offered', assignmentExpiresAt: new Date(Date.now() + 30000).toISOString(), assignmentMetadata: { adminOffer: true } };
context.alertNewAssistantOrders([], [offer]);
await Promise.resolve();
assert.equal(plays, 2, 'New broadcast discovered during task sync must ring');
context.alertNewAssistantOrders([], [offer]);
context.alertNewAssistantOrders([offer], [{ ...offer, assignmentStatus: 'accepted' }]);
assert.equal(plays, 2, 'Duplicate events and accepting an offer must not ring again');
context.alertNewAssistantOrders([offer], [offer, { assignmentId: 'confirm', assignmentStatus: 'accepted' }]);
await Promise.resolve();
assert.equal(plays, 2, 'A new Pending task discovered during sync must stay silent');
context.alertNewAssistantOrders([], [{ ...offer, assignmentId: 'expired', assignmentExpiresAt: new Date(Date.now() - 1000).toISOString() }]);
assert.equal(plays, 2, 'Expired Drop offers must not ring');
for (const [index, assignmentStatus] of ['accepted', 'assigned', 'in_progress', 'completed', 'success', 'cancelled', 'rejected', 'expired'].entries()) {
  context.alertNewAssistantOrders([], [{ ...offer, assignmentId: `silent-${index}`, assignmentStatus }]);
}
assert.equal(plays, 2, 'Pending, Processing, Success, Cancelled, Rejected and Drop tasks must stay silent');
blocked = true;
const blockedOffer = { ...offer, assignmentId: 'blocked', assignmentExpiresAt: new Date(Date.now() + 30000).toISOString() };
context.alertNewAssistantOrders([], [blockedOffer]);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(context.assistantOrderAudioPending, true);
blocked = false;
listeners.pointerdown();
await Promise.resolve();
assert.equal(context.assistantOrderAudioPending, false, 'Gesture must retry blocked audio');
assert.equal(context.assistantOrderAudio.volume, 0.9);
assert.equal(context.assistantOrderAudioRinging, true);
listeners.pointerdown();
assert.equal(context.assistantOrderAudioRinging, false, 'The next assistant interaction must acknowledge the bell');
context.alertAssistantRealtimeOrder('booking.offered', { assignmentId: 'safety-stop', assignmentStatus: 'offered', expiresAt: new Date(Date.now() + 30000).toISOString() });
await Promise.resolve();
assert.equal(typeof stopTimer, 'function');
stopTimer();
assert.equal(context.assistantOrderAudioRinging, false, 'The safety timer must stop a repeating bell');
context.alertAssistantRealtimeOrder('booking.offered', { assignmentId: 'processing-stop', assignmentStatus: 'offered', expiresAt: new Date(Date.now() + 30000).toISOString() });
await Promise.resolve();
context.stopAssistantOrderBellForRealtime('booking.updated', { assignmentId: 'processing-stop', assignmentStatus: 'in_progress' });
assert.equal(context.assistantOrderAudioRinging, false, 'Processing a broadcast must stop its bell');
context.alertNewAssistantOrders([], [{ ...offer, assignmentId: 'sync-stop' }]);
await Promise.resolve();
context.syncAssistantOrderBellWithTasks([{ ...offer, assignmentId: 'sync-stop', assignmentStatus: 'accepted' }]);
assert.equal(context.assistantOrderAudioRinging, false, 'Task synchronization must stop a bell after the offer leaves broadcast status');
assert.ok(pauses > 0);
context.state.token = '';
const before = plays;
context.playAssistantOrderBell();
assert.equal(plays, before, 'Logged-out app must not ring');
console.log('Assistant order bell: broadcast-only ringing, silent task statuses, deduplication, expiry, autoplay recovery and logout passed');
