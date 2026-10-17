import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { refreshAssistantAvailabilityCache } from "../dist/modules/operations/assistantDispatchEngine.js";

function sourceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  const signatureEnd = source.indexOf(") {", start);
  const bodyStart = signatureEnd + 2;
  assert.ok(signatureEnd >= 0, `${name} must have a function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to read ${name}`);
}

const portalClient = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const durationFunction = sourceFunction(portalClient, "customerTrackBaseDurationMinutes");
const sandbox = { normalizeArray: (value) => Array.isArray(value) ? value : [] };
vm.runInNewContext(`${durationFunction}; globalThis.durationFor = customerTrackBaseDurationMinutes;`, sandbox);

assert.equal(sandbox.durationFor(
  { durationMinutes: 120, metadata: { effectiveDurationMinutes: 120 } },
  [{ durationMinutes: 60 }]
), 120, "The persisted extended duration must override the original cart duration");
assert.equal(sandbox.durationFor(
  { durationMinutes: 30, metadata: {} },
  [{ durationMinutes: 30 }, { durationMinutes: 30 }]
), 60, "Multiple original items must retain their combined duration");

const plannedEndFunction = sourceFunction(portalClient, "customerTrackPlannedEndDate");
assert.ok(
  plannedEndFunction.indexOf("const explicitEnd") < plannedEndFunction.indexOf("const durationMinutes"),
  "Persisted booking_end_at must be authoritative after an extension"
);
assert.match(portalClient, /const effectiveDurationMinutes = normalizeArray\(trackItems\)\.length <= 1/);

const repository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
assert.match(repository, /set duration_minutes = \$11::int/);
assert.match(repository, /'effectiveDurationMinutes', \$11::int/);
assert.match(repository, /set reserved_until = \$2::timestamptz/);
assert.match(repository, /set end_at = \$2::timestamptz/);
const immediateExtensionStart = repository.indexOf("export async function approvePortalTimeExtension");
const immediateExtensionEnd = repository.indexOf("export async function createCustomerPortalBookingAddOnOrder", immediateExtensionStart);
const immediateExtension = repository.slice(immediateExtensionStart, immediateExtensionEnd);
assert.match(immediateExtension, /set duration_minutes = \$2::int/);
assert.match(immediateExtension, /'effectiveDurationMinutes', \$2::int/);
assert.match(immediateExtension, /status_code in \('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'accepted', 'active', 'in_progress'\)/);
assert.match(immediateExtension, /update zigo\.assistant_calendar_blocks/);
assert.match(immediateExtension, /recalculateAssistantAvailability\(\{ bookingId: row\.bookingId \}\)/);

const queries = [];
const now = new Date();
const expectedFreeAt = new Date(now.getTime() + 60 * 60_000);
const fakeClient = {
  async query(sql, params = []) {
    queries.push({ sql: String(sql), params });
    if (String(sql).includes('av.status_code as "statusCode"')) {
      return {
        rows: [{
          statusCode: "available",
          latitude: null,
          longitude: null,
          heartbeatAt: now,
          gpsCapturedAt: now,
          activeBlockType: "BOOKING",
          activeBlockEndAt: expectedFreeAt,
          activeBlockEndLat: null,
          activeBlockEndLng: null,
          activeBlockClusterId: null,
          nextBlockEndAt: expectedFreeAt,
          futureShiftAt: null
        }]
      };
    }
    return { rows: [], rowCount: 0 };
  }
};
const availability = await refreshAssistantAvailabilityCache("00000000-0000-4000-8000-000000000001", fakeClient);
assert.equal(availability.workStatus, "ASSIGNED");
assert.equal(availability.nextAvailableAt.toISOString(), expectedFreeAt.toISOString());
assert.ok(
  queries.some(({ sql }) => sql.includes("zigo.assistant_capacity_reservations") && sql.includes("reserved_until")),
  "Availability refresh must include capacity reservations when calendar blocks are absent"
);

console.log("Customer extension duration, end time, capacity reservation and assistant availability checks passed.");
