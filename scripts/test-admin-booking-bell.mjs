import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const helperSource = appSource.slice(
  appSource.indexOf("function bookingRealtimeAssignmentStatus("),
  appSource.indexOf("function handleBookingRealtimeEvent(")
);
const context = vm.createContext({ bookingRealtimeAlertedEventIds: new Set() });
vm.runInContext(helperSource, context);

const created = { id: "1", type: "booking.created", bookingId: "booking-1", message: "New booking received" };
assert.equal(context.bookingRealtimeAdminBellAlert(created)?.kind, "created");
assert.equal(context.rememberBookingRealtimeAdminBellEvent(created), true);
assert.equal(context.rememberBookingRealtimeAdminBellEvent(created), false, "The same realtime event must ring only once");

for (const event of [
  { id: "2", type: "booking.assigned", assistantId: "assistant-1", payload: { assignmentId: "assignment-1", assignmentStatus: "accepted" } },
  { id: "3", type: "booking.offered", assistantId: "assistant-1", payload: { assignmentId: "assignment-1", assignmentStatus: "offered" } },
  { id: "4", type: "booking.updated", assistantId: "assistant-1", payload: { assignmentId: "assignment-1", assignmentStatus: "in_progress" } },
  { id: "5", type: "booking.updated", assistantId: "assistant-1", payload: { assignmentId: "assignment-1", assignmentStatus: "completed" } }
]) {
  assert.equal(context.bookingRealtimeAdminBellAlert(event), null, `${event.type} ${event.payload.assignmentStatus} must stay silent`);
}

const rejected = { id: "6", type: "booking.updated", bookingId: "booking-1", assistantId: "assistant-1", tab: "pending_assign", payload: { assignmentId: "assignment-1", assignmentStatus: "rejected", returnedToPending: true } };
const dropped = { id: "7", type: "booking.updated", bookingId: "booking-1", assistantId: "assistant-1", tab: "pending_assign", payload: { assignmentId: "assignment-2", assignmentStatus: "expired", returnedToPending: true } };
assert.equal(context.bookingRealtimeAdminBellAlert(rejected)?.kind, "rejected");
assert.equal(context.bookingRealtimeAdminBellAlert(dropped)?.kind, "dropped");
assert.equal(context.bookingRealtimeAdminBellAlert({ ...rejected, id: "8", replayed: true }), null, "Replayed history must not produce stale sound");

assert.match(appSource, /source:\s*"event"/, "Event-driven list refreshes must suppress row-diff ringing");
const offerSource = readFileSync(new URL("../src/modules/operations/adminAssignmentOffers.ts", import.meta.url), "utf8");
const portalSource = readFileSync(new URL("../src/modules/portal/portal.routes.ts", import.meta.url), "utf8");
assert.match(offerSource, /assignmentStatus:'expired',returnedToPending:true/);
assert.match(portalSource, /pendingReason:returnedToPending/);
assert.match(portalSource, /pendingReason: returnedToPending \? "assistant_task_rejected"/);

console.log("Admin booking bell: new booking and returned-to-pending alerts passed; assigned and non-broadcast task events stay silent");
