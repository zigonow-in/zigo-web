import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import vm from "node:vm";

const portalSource = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const liveMapSource = readFileSync(new URL("../public/live-map.js", import.meta.url), "utf8");
const builtLiveMapSource = readFileSync(new URL("../public/assets/live-map.js", import.meta.url), "utf8");
const assistantLocationSource = readFileSync(new URL("../public/assistant-location.js", import.meta.url), "utf8");
const portalCss = readFileSync(new URL("../public/portal.css", import.meta.url), "utf8");
const portalHtml = readFileSync(new URL("../public/portal.html", import.meta.url), "utf8");
const riderAsset = new URL("../public/assets/zigo-assistant-bike-top.png", import.meta.url);

const routeHelperSource = portalSource.slice(
  portalSource.indexOf("function customerTrackJobStarted("),
  portalSource.indexOf("async function syncCustomerSdkMaps(")
);
const routeContext = vm.createContext({
  customerTrackStatus: booking => booking.status,
  customerTrackLocationRows: booking => booking.locations || [],
  customerTrackAssistantInfo: booking => ({ name: booking.assistantName || "Assistant", imageUrl: booking.assistantProfilePictureUrl || "", initials: "ZA" }),
  normalizeArray: value => Array.isArray(value) ? value : [],
  assetUrl: value => value
});
vm.runInContext(`${routeHelperSource};globalThis.customerSdkRoute = customerSdkRoute;globalThis.customerTrackJobStarted = customerTrackJobStarted;globalThis.customerTrackRouteDistanceText = customerTrackRouteDistanceText;`, routeContext);

const first = { latitude: 28.45, longitude: 77.05 };
const second = { latitude: 28.5, longitude: 77.1 };
const assignedRoute = routeContext.customerSdkRoute({ id: "booking-1", status: "assigned", locations: [first, second], liveRoute: { destinationLocation: second } });
assert.equal(assignedRoute.travelMode, "bike");
assert.equal(assignedRoute.routeStage, "pickup");
assert.equal(assignedRoute.stopLocations.length, 1, "Assigned tracking must route only to the first stop");
assert.equal(assignedRoute.destinationLocation.latitude, first.latitude);
assert.match(assignedRoute.riderImageUrl, /assets\/zigo-assistant-bike-top\.png/);
assert.equal(assignedRoute.markerMode, "bike");
assert.equal(assignedRoute.markerAnimationMs, 9500);
assert.equal(routeContext.customerTrackJobStarted({ status: "assigned" }), false, "Assignment alone must not expose the customer route");
assert.equal(routeContext.customerTrackJobStarted({ status: "assigned", metadata: { assistantJobStartedAt: "2026-10-15T10:00:00.000Z" } }), true);
assert.equal(routeContext.customerTrackRouteDistanceText({ distanceMeters: 900 }), "900 meters");
assert.equal(routeContext.customerTrackRouteDistanceText({ distanceMeters: 1200 }), "1.2 KM");
assert.equal(routeContext.customerTrackRouteDistanceText({ distanceMeters: 1000 }), "1 KM");

const workingRoute = routeContext.customerSdkRoute({ id: "booking-1", status: "working", locations: [first, second], assistantName: "Zigo Assistant", assistantProfilePictureUrl: "/uploads/assistant.jpg", liveRoute: { routeStage: "pickup", routePath: [first, second], routePolyline: [first, second] } });
assert.equal(workingRoute.routeStage, "task");
assert.equal(workingRoute.stopLocations.length, 2, "Working tracking may retain the full task route");
assert.equal(workingRoute.destinationLocation.latitude, second.latitude);
assert.equal(workingRoute.markerMode, "assistant", "Working tracking must replace the bike with the assistant marker");
assert.equal(workingRoute.assistantImageUrl, "/uploads/assistant.jpg");
assert.equal(workingRoute.assistantName, "Zigo Assistant");
assert.equal(workingRoute.routePath, null, "The old assistant-to-Stop-1 pickup path must be cleared when Working begins");
assert.equal(workingRoute.routePolyline, null);

assert.match(portalSource, /return \["assigned", "working"\]\.includes\(status\)/, "Assigned customers must join realtime tracking");
assert.match(portalSource, /const showsAssignedRoute = \["assigned", "working"\]\.includes\(normalizedStatus\)/);
assert.match(portalSource, /!customerTrackJobStarted\(booking\)/, "The map must remain hidden until Start Job");
assert.match(portalSource, /if \(liveRoutePing && !trackingStarted\) return false;/, "Pre-travel GPS must not create a customer route");
assert.match(portalSource, /Assistant is on the way/);
assert.doesNotMatch(portalSource, /Assistant route to start point/);
assert.match(portalSource, /scheduleCustomerTrackRouteRefresh\(bookingId\)/, "The first GPS fix must trigger road-route hydration");
assert.match(portalSource, /render\(\);\s*if \(bookingId\) void refreshCustomerTrackBookingRealtime\(bookingId\);/, "Opening Track Booking must hydrate the latest assigned route");
assert.match(repositorySource, /const trackingStops = taskStarted \? routeLocations : routeLocations\.slice\(0, 1\)/);
assert.match(repositorySource, /const routeOrigin = taskStarted \? trackingStops\[0\] : assistantLocation/);
assert.match(repositorySource, /const remainingStops = taskStarted \? trackingStops\.slice\(1\) : trackingStops/);
assert.match(repositorySource, /cachedTrackingRoute\(routeOrigin, routeDestination, intermediateWaypoints, "bike"\)/, "Working routes must begin at Stop 1 and continue to later stops");
assert.match(repositorySource, /taskStarted && !routeDestination \? "location_live"/, "Single-stop Working tasks must expose live location without a route line");
assert.match(repositorySource, /const jobStarted = taskStarted \|\| Boolean\(metadata\.assistantJobStartedAt\)/);
assert.match(repositorySource, /const bookingId = active\.rows\[0\]\?\.jobStartedAt \? active\.rows\[0\]\.bookingId : null;/);
assert.match(repositorySource, /travelMode: "bike"/);
assert.match(repositorySource, /distanceMeters,\s*distanceText: distanceMeters \? portalDistanceText\(distanceMeters\) : ""/);
assert.match(liveMapSource, /const showRiderMarker = navigation \|\| String\(initial\.travelMode \|\| ''\)\.toLowerCase\(\) === 'bike'/);
assert.match(liveMapSource, /const pathHeading = routeHeading\(path, target\)/, "Bike heading must follow the road path");
assert.match(liveMapSource, /Math\.min\(10000, configuredDuration\)/, "Marker interpolation must remain bounded between GPS fixes");
assert.match(liveMapSource, /headingDelta = \(\(riderHeading - fromHeading \+ 540\) % 360\) - 180/, "Bike turns must rotate through the shortest direction");
assert.match(liveMapSource, /element\.classList\.add\('uses-bike-image'\)/, "Customer tracking must use the rider image marker while travelling");
assert.match(liveMapSource, /element\.classList\.add\('uses-assistant-avatar'\)/, "Working tracking must use the assistant photo marker");
assert.match(liveMapSource, /riderMode\(\) === 'assistant' \? 0 : displayedHeading/, "The assistant photo must stay upright while moving");
assert.match(liveMapSource, /if \(showRiderMarker\) \{/);
assert.match(assistantLocationSource, /const PUBLISH_INTERVAL_MS = 10000/);
assert.match(assistantLocationSource, /now - sentAt < PUBLISH_INTERVAL_MS/, "Moving GPS fixes must publish at ten-second intervals");
assert.match(portalCss, /\.zigo-navigation-rider\.uses-bike-image/);
assert.match(portalCss, /\.zigo-navigation-rider\.uses-assistant-avatar/);
assert.match(portalCss, /\.zigo-assistant-map-pin/);
assert.ok(statSync(riderAsset).size > 1000, "The transparent top-down rider image must be packaged with the app");
assert.match(builtLiveMapSource, /Assistant bike position/, "The browser bundle must include the bike marker");
assert.match(builtLiveMapSource, /uses-assistant-avatar/, "The browser bundle must include the Working assistant photo marker");
assert.match(portalHtml, /portal\.css\?v=customer-working-assistant-marker-20261016/);
assert.match(portalHtml, /live-map\.js\?v=customer-working-assistant-marker-20261016/);
assert.match(portalHtml, /portal\.js\?v=customer-cart-stop-label-20261016/);

console.log("Customer tracking: travelling bike, Working assistant photo pin, ten-second GPS movement and cache versions passed");
