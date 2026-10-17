import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const helperSource = appSource.slice(
  appSource.indexOf("const defaultBookingBellPreferences"),
  appSource.indexOf("const bookingAlertAudio")
);
const context = vm.createContext({ state: { user: null } });
vm.runInContext(`${helperSource};globalThis.normalize = normalizeBookingBellPreferences;globalThis.defaults = defaultBookingBellPreferences;`, context);

assert.deepEqual({ ...context.normalize({}) }, { muted: false, volume: 0.9 });
assert.deepEqual({ ...context.normalize({ muted: true, volume: 0.4 }) }, { muted: true, volume: 0.4 });
assert.equal(context.normalize({ volume: 2 }).volume, 1);
assert.equal(context.normalize({ volume: 0 }).volume, 0.05);

const soundSource = appSource.slice(
  appSource.indexOf("function bookingBellSoundEnabled("),
  appSource.indexOf("function bookingBellPreferenceControls(")
);
const soundContext = vm.createContext({
  bookingRealtimeSettings: { playSound: true },
  bookingBellPreferences: { muted: false, volume: 0.5 },
  bookingPendingAssignmentCount: 0
});
vm.runInContext(soundSource, soundContext);
assert.equal(soundContext.bookingBellSoundEnabled(), true);
assert.equal(soundContext.pendingBookingAlarmShouldPlay(2), true, "Pending bookings must ring after login or refresh");
assert.equal(soundContext.pendingBookingAlarmShouldPlay(0), false);
soundContext.bookingBellPreferences.muted = true;
assert.equal(soundContext.bookingBellSoundEnabled(), false, "Muted admin preference must block sound");
assert.equal(soundContext.pendingBookingAlarmShouldPlay(2), false, "Muted admins must not ring for existing Pending bookings");
soundContext.bookingBellPreferences.muted = false;
soundContext.bookingRealtimeSettings.playSound = false;
assert.equal(soundContext.bookingBellSoundEnabled(), false, "Global sound disable must remain authoritative");
soundContext.bookingRealtimeSettings.playSound = true;

const syncSource = appSource.slice(
  appSource.indexOf("function updatePendingAssignmentBadge("),
  appSource.indexOf("async function refreshPendingAssignmentCount(")
);
let badgeHidden = true;
let alarmPlays = 0;
let alarmStops = 0;
let syncContext;
syncContext = vm.createContext({
  bookingPendingAssignmentCount: 0,
  pendingAssignmentCount: {
    textContent: "",
    classList: { toggle: (_name, hidden) => { badgeHidden = hidden; } },
    setAttribute: () => {}
  },
  bookingBellButton: {
    offsetWidth: 1,
    classList: { add: () => {}, remove: () => {} }
  },
  updateBookingBell: () => {},
  pendingBookingAlarmShouldPlay: () => syncContext.bookingPendingAssignmentCount > 0 && !syncContext.muted,
  playNewBookingRingtone: () => { alarmPlays += 1; },
  stopNewBookingRingtone: () => { alarmStops += 1; },
  muted: false
});
vm.runInContext(syncSource, syncContext);
assert.equal(syncContext.syncPendingBookingAlarm(3), 3);
assert.equal(syncContext.bookingPendingAssignmentCount, 3);
assert.equal(syncContext.pendingAssignmentCount.textContent, "3");
assert.equal(badgeHidden, false, "Pending menu count must stay visible while work remains");
assert.equal(alarmPlays, 1);
assert.equal(syncContext.syncPendingBookingAlarm(1), 1);
assert.equal(alarmPlays, 2, "The alarm must remain active after one of several bookings is assigned");
assert.equal(syncContext.syncPendingBookingAlarm(0), 0);
assert.equal(badgeHidden, true, "The pending badge may hide only after no pending bookings remain");
assert.equal(alarmStops, 1, "The alarm must stop when the pending total reaches zero");
syncContext.muted = true;
syncContext.syncPendingBookingAlarm(2);
assert.equal(alarmPlays, 2, "A saved muted preference must never be overridden by pending work");
assert.equal(alarmStops, 2);
syncContext.muted = false;
syncContext.syncPendingBookingAlarm(125);
assert.equal(syncContext.pendingAssignmentCount.textContent, "125", "The Bookings menu must show the exact remaining pending total");

const announceSource = appSource.slice(
  appSource.indexOf("function announcePendingBookingsOnAdminEntry("),
  appSource.indexOf("function schedulePendingAssignmentCountRefresh(")
);
let startupRings = 0;
const announceContext = vm.createContext({
  bookingPendingEntryAlerted: false,
  bookingPendingAssignmentCount: 3,
  bookingPendingEntryAlertPromise: null,
  adminSessionGeneration: 0,
  ensureBookingRealtimeSettings: async () => ({}),
  refreshPendingAssignmentCount: async () => { startupRings += 1; return 3; }
});
vm.runInContext(announceSource, announceContext);
assert.equal(await announceContext.announcePendingBookingsOnAdminEntry(), 3);
assert.equal(startupRings, 1, "Existing Pending bookings must synchronize the alarm on entry");
await announceContext.announcePendingBookingsOnAdminEntry();
assert.equal(startupRings, 1, "Admin entry synchronization must run only once per login/page load");

assert.match(appSource, /\/users\/me\/booking-bell-preferences/);
assert.match(appSource, /data-booking-bell-volume type="range"/);
assert.match(appSource, /if \(!pendingBookingAlarmShouldPlay\(\)\) return/);
assert.match(appSource, /range\.disabled = bookingBellPreferences\.muted/);
assert.match(appSource, /announcePendingBookingsOnAdminEntry\(\)\.catch/);
assert.match(appSource, /return syncPendingBookingAlarm\(count, \{ animate: count > bookingPendingAssignmentCount \}\)/);
assert.match(appSource, /if \(pendingBookingAlarmShouldPlay\(\)\) playNewBookingRingtone\(\)/, "Unmuting must resume a pending alarm");
assert.doesNotMatch(appSource, /acknowledgeNewBookingAlert/, "Opening Bookings or clicking the bell must not acknowledge pending work");
assert.match(appSource, /handleBookingNotificationRows\(payload\.data \|\| \[\], true\);\s*}\s*await refreshPendingAssignmentCount\(\);/, "Fallback polling must reconcile remaining Pending Assign bookings");

const indexSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
assert.match(indexSource, /id="pendingAssignmentCount"/, "Bookings navigation must retain its pending-count badge");

const routeSource = readFileSync(new URL("../src/modules/users/users.routes.ts", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("../src/modules/users/users.repository.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/modules/auth/auth.routes.ts", import.meta.url), "utf8");
assert.match(routeSource, /patch\("\/me\/booking-bell-preferences"/);
assert.match(repositorySource, /adminBookingBellPreferences/);
assert.match(authSource, /adminBookingBellPreferences: user\.metadata\?\.adminBookingBellPreferences/, "Login and refresh must restore the admin preference");

console.log("Admin booking bell preferences: user persistence, mute guard, volume range and disabled muted controls passed");
