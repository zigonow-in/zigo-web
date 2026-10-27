import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const portalSource = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const portalRoutes = readFileSync(new URL("../src/modules/portal/portal.routes.ts", import.meta.url), "utf8");
const portalRepository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const supportRepository = readFileSync(new URL("../src/modules/support/support.repository.ts", import.meta.url), "utf8");
const supportRoutes = readFileSync(new URL("../src/modules/support/support.routes.ts", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const portalHtml = readFileSync(new URL("../public/portal.html", import.meta.url), "utf8");
const migration = readFileSync(new URL("../database/release-migrations/20261015_012_assistant_support.sql", import.meta.url), "utf8");

const actionSource = portalSource.slice(
  portalSource.indexOf("function assistantTaskJobStarted("),
  portalSource.indexOf("function assistantTaskStartAt(")
);
const context = vm.createContext({
  escapeHtml: value => String(value ?? ""),
  customerIcon: name => `<i>${name}</i>`,
  assistantTaskTabFor: task => task._tab,
  assistantCanEnterStartPin: task => Boolean(task._startPinReady)
});
vm.runInContext(`${actionSource};globalThis.actions=assistantTaskActions;`, context);

const pending = { _tab: "accepted", assignmentId: "assignment-1", assignmentStatus: "accepted", assignmentMetadata: {}, metadata: {} };
const beforeStart = context.actions(pending);
assert.match(beforeStart, />Start Job</);
assert.match(beforeStart, />Cancel</);
assert.doesNotMatch(beforeStart, />Start PIN</);
assert.doesNotMatch(beforeStart, />Reject</);

const travelling = context.actions({ ...pending, assignmentMetadata: { jobStartedAt: "2026-10-15T10:00:00.000Z" } });
assert.doesNotMatch(travelling, />Start Job</);
assert.match(travelling, /data-task-status="in_progress"[^>]*hidden[^>]*>Start PIN</);
assert.match(travelling, />Cancel</);

const arrived = context.actions({ ...pending, _startPinReady: true, assignmentMetadata: { jobStartedAt: "2026-10-15T10:00:00.000Z", reachedAt: "2026-10-15T10:05:00.000Z" } });
assert.match(arrived, />Start PIN</);
assert.doesNotMatch(arrived, /data-task-status="in_progress"[^>]*hidden/);
assert.match(arrived, />Cancel</);

const footerSource = portalSource.slice(
  portalSource.indexOf("function assistantTrackFooterControls("),
  portalSource.indexOf("function assistantSupportModalHtml(")
);
const footerContext = vm.createContext({
  escapeHtml: value => String(value ?? ""),
  assistantTaskTabFor: task => task._tab,
  assistantTaskJobStarted: task => Boolean(task.assignmentMetadata?.jobStartedAt),
  assistantCanEnterStartPin: task => Boolean(task._startPinReady),
  assistantArrivalInstruction: suffix => `Reach within configured radius${suffix}`,
  assistantTaskHelpButton: () => "<button>Help</button>"
});
vm.runInContext(`${footerSource};globalThis.footer=assistantTrackFooterControls;`, footerContext);
const travellingDetail = footerContext.footer({ ...pending, assignmentMetadata: { jobStartedAt: "2026-10-15T10:00:00.000Z" } });
assert.match(travellingDetail, /data-task-status="in_progress"[^>]*hidden[^>]*>Start PIN</);
assert.match(travellingDetail, /Reach within configured radius to enter Start PIN/);
const arrivedDetail = footerContext.footer({ ...pending, _startPinReady: true, assignmentMetadata: { jobStartedAt: "2026-10-15T10:00:00.000Z" } });
assert.doesNotMatch(arrivedDetail, /data-task-status="in_progress"[^>]*hidden/);
assert.match(arrivedDetail, /Within arrival radius\. Start PIN available\./);

const processing = context.actions({ ...pending, _tab: "working", assignmentStatus: "in_progress" });
assert.match(processing, />End PIN</);
assert.match(processing, />Help</);
assert.doesNotMatch(processing, />Cancel</);

assert.match(portalRoutes, /assistant\/tasks\/:assignmentId\/start-job/);
assert.match(portalRoutes, /assistant\/support\/tickets/);
assert.match(portalRepository, /export async function startAssistantPortalJob/);
assert.match(portalRepository, /Select Start Job before entering the Start PIN/);
assert.match(portalRepository, /jobStartedAt' as "jobStartedAt"/);
assert.match(portalRepository, /active\.rows\[0\]\?\.jobStartedAt/);
assert.match(portalSource, /button\.hidden = !canEnterStartPin/);
assert.match(portalSource, /assistantStartEligibilityByTask\.get\(task\?\.assignmentId\)/);
const startJobHandler = portalSource.slice(
  portalSource.indexOf('const startAssistantJobButton = event.target.closest("[data-start-assistant-job]")'),
  portalSource.indexOf('const earlyTaskButton = event.target.closest("[data-task-status]")')
);
assert.doesNotMatch(startJobHandler, /if \(!state\.assistantIsOnline\)[\s\S]*?return;/);
assert.match(startJobHandler, /setAssistantOnlineStatus\(true, point, requestId\)/);
assert.match(startJobHandler, /Refresh the server-side heartbeat\/GPS state/);
assert.match(startJobHandler, /\/portal\/assistant\/location-pings/);

assert.match(supportRepository, /zigo\.assistant_support_tickets/);
assert.match(supportRepository, /zigo\.assistant_support_messages/);
assert.match(supportRepository, /export async function createAssistantSupportTicket/);
assert.match(supportRoutes, /supportRouter\.get\("\/assistant\/tickets"/);
assert.match(portalSource, /tel:\+918448736662/);
assert.match(portalSource, /requesterType === "assistant"/);

assert.match(adminHtml, /data-section="assistantSupport"/);
assert.match(adminHtml, /id="assistantSupportSection"/);
assert.match(adminSource, /function renderAssistantSupportWorkspace/);
assert.match(adminSource, /\/support\/assistant\/tickets/);
assert.match(adminSource, /requesterType === "assistant"/);

assert.match(migration, /create table if not exists zigo\.assistant_support_tickets/);
assert.match(migration, /create table if not exists zigo\.assistant_support_messages/);
assert.doesNotMatch(migration, /\b(drop|truncate|delete\s+from)\b/i);
assert.match(portalHtml, /portal\.css\?v=[a-z0-9-]+/i);
assert.match(portalHtml, /portal\.js\?v=[a-z0-9-]+/i);
assert.match(adminHtml, /styles\.css\?v=ai-work-query-20261018/);
assert.match(adminHtml, /app\.js\?v=ai-work-query-20261018/);

console.log("Assistant lifecycle and support: action gating, persisted travel phase, realtime chat, Admin workspace and additive migration passed");
