import assert from "node:assert/strict";
import {
  DEFAULT_ASSISTANT_MASTER_SETTINGS,
  calculateAssistantDistanceSlabs,
  normalizeAssistantMasterSettings,
  validateAssistantDistanceSlabs
} from "../dist/modules/settings/assistantMasterSettings.js";

const travelCost = calculateAssistantDistanceSlabs(DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostSlabs, 20);
assert.equal(travelCost.totalPaise, 19000, "20 km travel cost must be INR 190");
assert.deepEqual(travelCost.lines.map((line) => line.amountPaise), [5000, 2000, 4500, 4000, 3500]);

const assistantPayout = calculateAssistantDistanceSlabs(DEFAULT_ASSISTANT_MASTER_SETTINGS.assistantTravelPayoutSlabs, 20);
assert.equal(assistantPayout.totalPaise, 19000, "20 km assistant payout must be INR 190");

assert.match(
  validateAssistantDistanceSlabs([
    { fromKm: 0, toKm: 3, rateType: "fixed", ratePaise: 5000 },
    { fromKm: 4, toKm: 5, rateType: "per_km", ratePaise: 1000 }
  ]) || "",
  /must start where/i
);

const normalized = normalizeAssistantMasterSettings({
  broadcastTimeSeconds: 2,
  autoArrivedRadiusMeters: 9000,
  dryRunDistanceKm: -4
});
assert.equal(normalized.broadcastTimeSeconds, 5);
assert.equal(normalized.autoArrivedRadiusMeters, 5000);
assert.equal(normalized.dryRunDistanceKm, 0);

console.log("Assistant Master settings regression checks passed.");
