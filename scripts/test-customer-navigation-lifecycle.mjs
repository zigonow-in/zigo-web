import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portalSource = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");

const helperStart = portalSource.indexOf("function portalCalendarDay(");
const helperEnd = portalSource.indexOf("const portalToday", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "calendar-day helper must exist");
const portalCalendarDay = new Function(`${portalSource.slice(helperStart, helperEnd)}; return portalCalendarDay;`)();

assert.equal(portalCalendarDay("2026-10-28T00:01:00+05:30"), "2026-10-28");
assert.equal(portalCalendarDay("2026-10-29T00:01:00+05:30"), "2026-10-29");
assert.equal(
  portalCalendarDay("2026-10-28T23:59:59+05:30") === portalCalendarDay("2026-10-28T08:00:00+05:30"),
  true,
  "same-day sessions must remain eligible for page restoration"
);
assert.equal(
  portalCalendarDay("2026-10-27T23:59:59+05:30") === portalCalendarDay("2026-10-28T08:00:00+05:30"),
  false,
  "previous-day sessions must start from Home"
);

assert.match(portalSource, /customerCachedSessionIsCurrentDay/);
assert.match(portalSource, /customerCachedSessionIsCurrentDay \? String\(cachedSession\.customerView\) : "home"/);
assert.match(portalSource, /navigationDay: actor === "customer" \? portalCalendarDay\(\) : undefined/);
assert.match(portalSource, /navigationDay: portalCalendarDay\(\)/);
assert.match(portalSource, /function isCurrentCustomerHistoryState/);
assert.match(portalSource, /if \(!isCurrentCustomerHistoryState\(event\.state\)\)/);
assert.match(portalSource, /window\.history\.forward\(\)/);
assert.match(portalSource, /function resetCustomerNavigationForNewDay/);
assert.match(portalSource, /resetCustomerNavigationForNewDay\(\);/);

console.log("Customer navigation lifecycle checks passed: same-day restore, next-day Home reset, transient state reset, and stale history protection.");
