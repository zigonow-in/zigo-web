import assert from "node:assert/strict";
import {
  DEFAULT_ASSISTANT_MASTER_SETTINGS,
  calculateAssistantDistanceSlabs,
  normalizeAssistantMasterSettings,
  validateAssistantDistanceSlabs
} from "../dist/modules/settings/assistantMasterSettings.js";

const travelCost = calculateAssistantDistanceSlabs(
  DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostSlabs,
  20,
  DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostBasePaise
);
assert.equal(travelCost.totalPaise, 22000, "20 km travel cost must include the INR 30 base price");
assert.deepEqual(travelCost.lines.map((line) => line.amountPaise), [5000, 2000, 4500, 4000, 3500]);

const assistantPayout = calculateAssistantDistanceSlabs(DEFAULT_ASSISTANT_MASTER_SETTINGS.assistantTravelPayoutSlabs, 20);
assert.equal(assistantPayout.totalPaise, 19000, "20 km assistant payout must be INR 190");

const wholeKilometreSlabs = [
  { fromKm: 0, toKm: 3, rateType: "per_km", ratePaise: 1000 },
  { fromKm: 4, toKm: 8, rateType: "per_km", ratePaise: 900 },
  { fromKm: 9, toKm: 12, rateType: "per_km", ratePaise: 800 }
];
assert.equal(validateAssistantDistanceSlabs(wholeKilometreSlabs), null);
const wholeKilometreCost = calculateAssistantDistanceSlabs(wholeKilometreSlabs, 12, 3000);
assert.equal(wholeKilometreCost.totalPaise, 13700);
assert.deepEqual(wholeKilometreCost.lines.map((line) => line.billableKm), [3, 5, 4]);
assert.equal(calculateAssistantDistanceSlabs(wholeKilometreSlabs, 0, 3000).totalPaise, 3000);

assert.match(validateAssistantDistanceSlabs([
  wholeKilometreSlabs[0],
  { fromKm: 5, toKm: 8, rateType: "per_km", ratePaise: 900 }
]) || "", /previous boundary|next whole kilometre/i);

const normalized = normalizeAssistantMasterSettings({
  broadcastTimeSeconds: 2,
  autoArrivedRadiusMeters: 9000,
  dryRunDistanceKm: -4
});
assert.equal(normalized.broadcastTimeSeconds, 5);
assert.equal(normalized.autoArrivedRadiusMeters, 5000);
assert.equal(normalized.dryRunDistanceKm, 0);
assert.equal(normalized.travelCostBasePaise, 3000);

console.log("Assistant Master settings regression checks passed.");
