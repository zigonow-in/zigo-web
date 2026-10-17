import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { customerBookingCancelEligibility } from "../dist/modules/portal/portal.repository.js";

const settings = {
  customerAssistantDelayCancelOpenMinutes: 10,
  customerAssistantDelayAutoCancelMinutes: 30
};
const plannedStartAt = new Date("2026-10-16T10:00:00.000Z");
const assignedBooking = {
  statusCode: "accepted",
  assignmentId: "assignment-1",
  assignmentStatus: "accepted",
  bookingStartAt: plannedStartAt
};

const beforeWindow = customerBookingCancelEligibility(assignedBooking, settings, new Date("2026-10-16T10:09:59.000Z"));
assert.equal(beforeWindow.canCancel, true);
assert.equal(beforeWindow.reasonCode, "customer_cancel_after_assignment");

const openWindow = customerBookingCancelEligibility(assignedBooking, settings, new Date("2026-10-16T10:10:00.000Z"));
assert.equal(openWindow.canCancel, true);
assert.equal(openWindow.reasonCode, "customer_cancel_assistant_delay");

const overdueWorker = customerBookingCancelEligibility(assignedBooking, settings, new Date("2026-10-16T10:31:00.000Z"));
assert.equal(overdueWorker.canCancel, true, "A delayed worker must not cause a customer cancellation conflict");

const startedBooking = customerBookingCancelEligibility(
  { ...assignedBooking, actualTaskStartedAt: "2026-10-16T10:11:00.000Z" },
  settings,
  new Date("2026-10-16T10:12:00.000Z")
);
assert.equal(startedBooking.canCancel, true);
assert.equal(startedBooking.reasonCode, "customer_cancel_after_start");

const unassignedBooking = customerBookingCancelEligibility(
  { statusCode: "queued", bookingStartAt: plannedStartAt },
  settings,
  new Date("2026-10-16T09:55:00.000Z")
);
assert.equal(unassignedBooking.canCancel, true);
assert.equal(unassignedBooking.reasonCode, "customer_cancel_before_assignment");

const completedBooking = customerBookingCancelEligibility(
  { ...assignedBooking, statusCode: "completed" },
  settings,
  new Date("2026-10-16T10:12:00.000Z")
);
assert.equal(completedBooking.canCancel, false);

const bookingEngine = readFileSync(new URL("../src/modules/operations/bookingEngine.ts", import.meta.url), "utf8");
assert.match(bookingEngine, /sr\.booking_start_at \+ \(\$1::int \* interval '1 minute'\) as expiry_at/);
assert.doesNotMatch(
  bookingEngine,
  /coalesce\(sr\.booking_end_at, sr\.booking_start_at \+ \(\$1::int \|\| ' minutes'\)::interval\) as expiry_at/
);

const portalClient = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const portalRepository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const operationsRepository = readFileSync(new URL("../src/modules/operations/operations.repository.ts", import.meta.url), "utf8");
const operationsRoutes = readFileSync(new URL("../src/modules/operations/operations.routes.ts", import.meta.url), "utf8");
const adminCancelRepository = operationsRepository.slice(
  operationsRepository.indexOf("export async function cancelBookingByAdmin"),
  operationsRepository.indexOf("export async function confirmBookingPaymentByAdmin")
);
const adminCancelRoute = operationsRoutes.slice(
  operationsRoutes.indexOf('operationsRouter.post("/bookings/:id/cancel"'),
  operationsRoutes.indexOf('operationsRouter.post("/bookings/:id/payment-confirmation"')
);
assert.match(portalClient, /function customerCancelSectionHtml/);
assert.match(portalClient, /data-cancel-booking=.*Cancel Task/);
assert.match(portalClient, /function customerTrackAdminCancellationUpdate/);
assert.match(portalClient, /Booking cancelled by admin\. Reason: \$\{reason\}/);
assert.match(portalClient, /cancelledBy: isCancelledEvent \? eventPayload\.cancelledBy/);
assert.doesNotMatch(portalClient, /if \(startedAt \|\| isNotCancellable\) return ""/);
assert.doesNotMatch(portalClient, /assistantAssigned && openAt && now < openAt\.getTime\(\)/);
assert.match(portalRepository, /recalculateAssistantAvailability\(\{ bookingId: row\.bookingId \}\)/);
assert.match(portalRepository, /sr\.cancelled_reason as "cancelledReason"/);
assert.match(adminCancelRepository, /insert into zigo\.booking_task_updates/);
assert.match(adminCancelRepository, /Booking cancelled by admin\. Reason: \$\{reason\}/);
assert.match(adminCancelRepository, /cancellationReasonCode: "admin_cancelled_booking"/);
assert.match(adminCancelRoute, /reasonCode: "admin_cancelled_booking"/);
assert.match(adminCancelRoute, /reason,\s*reasonCode/);

console.log("Customer cancellation eligibility and admin cancellation chat reason checks passed.");
