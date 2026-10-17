import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portalClient = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const tracker = readFileSync(new URL("../public/assistant-location.js", import.meta.url), "utf8");
const portalRepository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const operationsRepository = readFileSync(new URL("../src/modules/operations/operations.repository.ts", import.meta.url), "utf8");
const bookingEngine = readFileSync(new URL("../src/modules/operations/bookingEngine.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../database/release-migrations/20261016_013_assistant_live_lease_index.nontransactional.sql", import.meta.url), "utf8");
const backfillMigration = readFileSync(new URL("../database/release-migrations/20261016_014_assistant_availability_backfill.sql", import.meta.url), "utf8");

const permissionHandler = portalClient.slice(
  portalClient.indexOf("onPermissionDenied: () =>"),
  portalClient.indexOf("});", portalClient.indexOf("onPermissionDenied: () =>"))
);
assert.doesNotMatch(permissionHandler, /setAssistantOnlineStatus\(false/);
assert.match(permissionHandler, /Location permission denied/);
assert.match(portalClient, /assistantAvailabilityMutationId/);
assert.match(portalClient, /state\.assistantAvailabilityBusy/);
assert.match(portalClient, /applyAssistantAvailabilitySnapshot/);
assert.match(portalClient, /syncAssistantAvailabilitySnapshot/);

assert.match(tracker, /watchToken/);
assert.match(tracker, /scheduleUploadRetry/);
assert.match(tracker, /Permission failure keeps the session recoverable|permission_denied/);
assert.doesNotMatch(tracker, /permissionDenied\) \{\s*stop\(\)/);

assert.match(operationsRepository, /upper\(coalesce\(av\.presence_status, 'OFFLINE'\)\) = 'ONLINE'/);
assert.match(operationsRepository, /av\.heartbeat_at >= now\(\) - \(\$4::int \* interval '1 second'\)/);
assert.match(operationsRepository, /av\.gps_captured_at >= now\(\) - \(\$5::int \* interval '1 second'\)/);
assert.match(operationsRepository, /assistant\.presenceStatus !== "ONLINE"/);
assert.match(operationsRepository, /dispatchConfig\.heartbeatTimeoutSeconds/);
assert.match(operationsRepository, /dispatchConfig\.gpsFreshnessSeconds/);
assert.match(operationsRepository, /join zigo\.assistant_availability av on av\.assistant_id = a\.id/);
assert.match(operationsRepository, /for update of a, av/);

assert.match(portalRepository, /where \$2::uuid is not null/);
assert.match(portalRepository, /ignoredReason: onlineIntent \? "out_of_order" : "offline"/);
assert.match(portalRepository, /status_code = case[\s\S]*then \$2::text[\s\S]*else zigo\.assistant_availability\.status_code/);
assert.match(portalRepository, /Wait for live GPS sync before starting the job/);

const releaseGuards = [...bookingEngine.matchAll(/lower\(coalesce\(av\.status_code, 'offline'\)\) in \('available', 'online', 'active', 'working'\)/g)];
assert.ok(releaseGuards.length >= 2, "Task/capacity release must preserve an explicit Offline choice");
assert.match(migration, /create index concurrently if not exists idx_assistant_availability_live_lease/);
assert.match(backfillMigration, /insert into zigo\.assistant_availability/);
assert.match(backfillMigration, /where av\.assistant_id is null/);

console.log("Assistant availability intent, fresh GPS lease, assignment locks, task-state guards, idle-history control and live-presence schema checks passed.");
