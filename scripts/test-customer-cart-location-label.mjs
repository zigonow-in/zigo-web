import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const portalSource = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");

function sourceForFunction(name) {
  const start = portalSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} was not found in public/portal.js`);
  const signatureEnd = portalSource.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${name} does not have a standard function signature`);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  for (let index = bodyStart; index < portalSource.length; index += 1) {
    if (portalSource[index] === "{") depth += 1;
    if (portalSource[index] === "}") depth -= 1;
    if (depth === 0) return portalSource.slice(start, index + 1);
  }
  throw new Error(`${name} does not have a complete function body`);
}

const context = vm.createContext({});
vm.runInContext(`
  ${sourceForFunction("customerCartRouteTitle")}
  ${sourceForFunction("locationFormLabel")}
  globalThis.customerCartRouteTitle = customerCartRouteTitle;
  globalThis.locationFormLabel = locationFormLabel;
`, context);

assert.equal(context.locationFormLabel({}), "", "An unselected optional label must stay empty");
assert.equal(context.locationFormLabel({ label: "Home" }), "Home", "An explicitly selected Home label must be preserved");
assert.equal(context.locationFormLabel({ label: "Other", customLabel: "Parents" }), "Parents");

const pickedMapLocation = {
  address: "EWS Vatika City, Sector 49, Gurugram, Haryana",
  latitude: 28.4123,
  longitude: 77.0512,
  source: "map"
};
assert.equal(context.customerCartRouteTitle(pickedMapLocation, "Stop"), "EWS Vatika City");
assert.equal(
  context.locationFormLabel({}) || context.customerCartRouteTitle(pickedMapLocation, "Stop"),
  "EWS Vatika City",
  "A map-picked cart stop must use its place/address instead of a synthetic Home label"
);
assert.equal(context.customerCartRouteTitle({ ...pickedMapLocation, label: "Home" }, "Stop"), "Home");
assert.equal(context.customerCartRouteTitle({ ...pickedMapLocation, label: "Current location" }, "Stop"), "EWS Vatika City");

console.log("Customer cart location label regression checks passed.");
