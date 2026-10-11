import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/portal.js', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('function scheduleAssistantTaskRefresh('), source.indexOf('function upsertCustomerBookingInState('));
let calls = 0;
let resolveFirst;
let renders = 0;
let bellEvents = 0;
const streams = [];
class EventSourceMock {
  constructor() { this.listeners = {}; streams.push(this); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  close() {}
}
const context = vm.createContext({
  actor: 'assistant', state: { token: 'fixture', tasks: [] },
  window: { EventSource: EventSourceMock }, EventSource: EventSourceMock,
  document: { visibilityState: 'visible' }, navigator: { onLine: true },
  Date, URLSearchParams, setTimeout, clearTimeout,
  setInterval: () => { throw new Error('Assistant realtime must not poll'); },
  assistantRealtimeSource: null, assistantRealtimeRefreshTimer: null,
  assistantRealtimeRefreshBusy: false, assistantRealtimeRefreshPending: false,
  assistantRealtimeLastEventId: '', assistantRealtimeHeartbeatAt: 0,
  assistantRealtimeSafetyTimer: null,
  stopAssistantRealtime() { context.assistantRealtimeSource?.close(); context.assistantRealtimeSource = null; },
  withBasePath: value => value, syncPortalTrackingHub() {},
  portalCachedGet: async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return { data: [{ assignmentStatus: 'offered', assignmentId: 'new-offer' }] };
  },
  rebuildAssistantTaskTabIndex() {}, startAssistantLocationPings() {}, stopAssistantLocationPings() {},
  writePortalSessionCache() {}, renderAssistantTaskView() { renders++; return true; },
  alertNewAssistantOrders() {},
  stopAssistantOrderBellForRealtime() {},
  alertAssistantRealtimeOrder(type) { if (type === 'booking.offered') bellEvents++; },
  render() {}, renderAssistantHome() {}, notify() {}, clearPortalSession() {}, forcePortalSessionLogout() {}
});
vm.runInContext(section, context);

context.startAssistantRealtime();
streams[0].listeners.connected();
assert.equal(calls, 1, 'Connection must sync tasks immediately');
streams[0].listeners.assistant_task_changed({ data: JSON.stringify({ type: 'booking.offered', payload: { assignmentId: 'new-offer' } }) });
assert.equal(bellEvents, 1, 'Broadcast event must trigger the bell immediately');
assert.equal(context.assistantRealtimeRefreshPending, true);
// A slow fetch used to outlive the queued timer, silently losing the new offer.
await new Promise(resolve => setTimeout(resolve, 350));
resolveFirst({ data: [] });
await new Promise(resolve => setTimeout(resolve, 350));
assert.equal(calls, 2);
assert.equal(context.state.tasks[0].assignmentId, 'new-offer');
assert.equal(renders, 1);

streams[0].onerror();
await new Promise(resolve => setTimeout(resolve, 350));
assert.equal(calls, 2, 'Disconnected SSE must reconnect without polling');
context.startAssistantRealtime(true);
streams[1].listeners.connected();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(calls, 3, 'Reconnection must catch up immediately');
assert.equal(renders, 1, 'Unchanged tasks must not render again');
console.log('Assistant realtime: connection sync, overlapping offer delivery, no polling, unchanged-state stability and reconnect passed');
