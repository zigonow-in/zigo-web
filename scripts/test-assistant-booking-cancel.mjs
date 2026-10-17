import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portal = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const routes = readFileSync(new URL("../src/modules/portal/portal.routes.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const bookingEngine = readFileSync(new URL("../src/modules/operations/bookingEngine.ts", import.meta.url), "utf8");

assert.match(portal, /data-task-status="cancelled" data-task-action-label="cancel"/);
assert.match(portal, /data-task-status="rejected" data-id="\$\{assignmentId\}"[^>]*>Reject<\/button>/);
assert.match(portal, /data-assistant-task-cancel-reason/);
assert.match(portal, /pending\.status === "cancelled" \? \{ reason \} : \{\}/);
assert.match(portal, /\["cancelled", "canceled"\]\.includes\(nextStatus\)[\s\S]{0,80}\? "cancelled"/);
assert.match(portal, /const assistantCancelled = status === "cancelled"/);
assert.match(portal, /metadata\.cancellationReasonCode[\s\S]{0,120}assistant_cancelled_booking/);
assert.match(portal, /if \(status === "confirmed" \|\| assistantCancelled\)/);
assert.match(portal, /function customerTrackIsInternalAssistantRejection/);
assert.match(portal, /taskUpdates\(booking\)\.filter\(\(update\) => !customerTrackIsInternalAssistantRejection\(update\)\)/);

assert.match(routes, /z\.enum\(\["accepted", "in_progress", "completed", "rejected", "cancelled"\]\)/);
assert.match(routes, /value\.status === "cancelled"[\s\S]{0,180}Enter a cancellation reason/);
assert.match(routes, /type: assistantCancelled \? "booking\.cancelled" : "booking\.updated"/);
assert.match(routes, /statusCode: assistantCancelled \? "cancelled" : undefined/);
assert.match(routes, /autoCancelled: assistantCancelled \? false : undefined/);

const cancelBranchStart = repository.indexOf('} else if (input.status === "cancelled")');
const cancelBranchEnd = repository.indexOf("} else {", cancelBranchStart + 1);
assert.ok(cancelBranchStart >= 0 && cancelBranchEnd > cancelBranchStart, "Assistant cancellation transaction must exist");
const cancelBranch = repository.slice(cancelBranchStart, cancelBranchEnd);
assert.match(cancelBranch, /update zigo\.task_assignments[\s\S]*status_code = 'cancelled'/);
assert.match(cancelBranch, /update zigo\.service_requests[\s\S]*status_code = 'cancelled'/);
assert.match(cancelBranch, /cancelled_reason = \$3/);
assert.match(cancelBranch, /releaseCapacityReservations/);
assert.match(cancelBranch, /last_event_type = 'assistant\.cancelled_booking'/);
assert.match(cancelBranch, /Booking cancelled by assistant\. Reason:/);
assert.match(repository, /stopAssistantCalendarBlocksForBooking\(\{ bookingId: current\.bookingId, status: "cancelled" \}\)/);
assert.match(repository, /recalculateAssistantAvailability\(\{ bookingId: current\.bookingId \}\)/);
assert.match(repository, /input\.status === "rejected"[\s\S]{0,120}\? "queued"/);
const taskUpdatesStart = repository.indexOf("async function taskUpdatesByBookingIds");
const taskUpdatesEnd = repository.indexOf("export async function markPortalBookingTaskUpdatesRead", taskUpdatesStart);
const taskUpdatesQuery = repository.slice(taskUpdatesStart, taskUpdatesEnd);
assert.match(taskUpdatesQuery, /coalesce\(\$3::text, ''\) = 'customer'/);
assert.match(taskUpdatesQuery, /metadata->>'assistantRejectedCopy'/);
assert.match(taskUpdatesQuery, /metadata->>'rejectionSource'/);
assert.match(bookingEngine, /status_code in \('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'accepted', 'active', 'in_progress'\)/);

console.log("Assistant cancellation and rejection privacy, realtime status and capacity cleanup checks passed.");
