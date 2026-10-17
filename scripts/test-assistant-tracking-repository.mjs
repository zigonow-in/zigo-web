import 'dotenv/config';
import assert from 'node:assert/strict';
import { pool } from '../dist/db/pool.js';
import { recordAssistantPortalLocationPing, getAssistantLiveTracking, confirmAssistantPortalArrival } from '../dist/modules/portal/portal.repository.js';
const userId = '00000000-0000-4000-8000-000000000001', assistantId = '00000000-0000-4000-8000-000000000002';
const original = pool.query;
let online = true, active = true, previous = null, writes = 0, schemas = 0, withTask = false, arrivals = 0, latestFix = null;
pool.query = async (sql, params = []) => {
  if (sql.includes('create table if not exists zigo.assistant_location_pings')) { schemas++; return { rows: [] }; }
  if (sql.startsWith('select id from zigo.assistants')) return { rows: [{ id: assistantId }] };
  if (sql.includes("ta.metadata->>'reachedAt' as")) {
    assert.match(sql,/ta.id = \$1 and a.user_id = \$2/);
    assert.match(sql,/sr.accepted_assignment_id = ta.id/);
    return {rows:online && active && params[0]===assistantId ? [{bookingId:userId,...latestFix,stopLatitude:28.6,stopLongitude:77.2,reachedAt:previous?.toISOString()}] : []};
  }
  if (sql.includes('select sr.id as "bookingId"') && !sql.includes('select a.id as "assistantId", av.status_code')) return { rows: withTask && (!params[1] || params[1]===assistantId) ? [{bookingId:userId,assignmentId:assistantId,latitude:28.6,longitude:77.2,jobStartedAt:new Date().toISOString()}] : [] };
  if (sql.includes('with reached as')) {
    assert.match(sql,/sr.accepted_assignment_id = ta.id/);
    assert.match(sql,/actual_started_at is null/);
    assert.match(sql,/not \(coalesce\(ta.metadata/);
    arrivals++; return {rows:[{reachedAt:params[2]}]};
  }
  if (sql.includes('with accepted as')) {
    assert.match(sql, /av\.gps_captured_at < \$6/);
    assert.match(sql, /lower\(av\.status_code\)/);
    assert.match(sql, /where \$2::uuid is not null/, 'Idle availability pings must not create history rows');
    assert.match(sql, /u\.deleted_at is null/);
    assert.match(sql, /metadata->>'accountStatus'/);
    assert.equal(params[7], userId);
    if (!online || !active || (previous && params[5] <= previous)) return { rows: [] };
    previous = params[5]; writes++;
    latestFix={latitude:params[2],longitude:params[3],accuracy:params[4],capturedAt:params[5]};
    return { rows: [{ id: 'ping', assistantId, bookingId: null, latitude: params[2], longitude: params[3], accuracyMeters: params[4], capturedAt: params[5] }] };
  }
  if (sql.includes("select lower(coalesce(status_code, 'offline'))")) {
    return { rows: [{ statusCode: online ? 'available' : 'offline', presenceStatus: online ? 'ONLINE' : 'OFFLINE', gpsCapturedAt: previous, updatedAt: new Date() }] };
  }
  if (sql.includes('select a.id as "assistantId", av.status_code')) {
    assert.match(sql, /sr.accepted_assignment_id = ta.id/);
    assert.match(sql, /\$2::uuid is null or ta.id = \$2::uuid/);
    return { rows: [{ assistantId, latitude: 28.6, longitude: 77.2, capturedAt: previous, locations: [], accuracy: 8 }] };
  }
  if (sql.includes('from zigo.app_settings')) return { rows: [] };
  throw new Error(`Unexpected query: ${sql.slice(0, 90)}`);
};
const fix = timestamp => ({ latitude: 28.6, longitude: 77.2, accuracy: 8, capturedAt: new Date(timestamp).toISOString(), speed: 1, heading: 90 });
try {
  const now = Date.now();
  const saved = await recordAssistantPortalLocationPing(userId, fix(now));
  assert.equal(saved.accuracyMeters, 8); assert.equal(writes, 1);
  assert.equal((await recordAssistantPortalLocationPing(userId, fix(now))).ignored, true);
  assert.equal((await recordAssistantPortalLocationPing(userId, fix(now - 1000))).ignored, true);
  online = false; assert.equal((await recordAssistantPortalLocationPing(userId, fix(now + 1))).ignored, true);
  online = true; active = false; assert.equal((await recordAssistantPortalLocationPing(userId, fix(now + 2))).ignored, true);
  assert.equal(writes, 1, 'Offline, revoked, duplicate and out-of-order fixes do not create history');
  await assert.rejects(recordAssistantPortalLocationPing(userId, fix(now - 60000)), e => e.statusCode === 400);
  await assert.rejects(recordAssistantPortalLocationPing(userId, { ...fix(now), accuracy: 1000 }), e => e.statusCode === 400);
  const snapshot = await getAssistantLiveTracking(assistantId);
  assert.equal(snapshot.assistantLocation.latitude, 28.6); assert.equal(schemas, 1, 'Schema initialization is not repeated for every ping');
  active=true; withTask=true;
  const arrived=await recordAssistantPortalLocationPing(userId,fix(now+3));
  assert.equal(arrived.startEligibility.eligible,true); assert.ok(arrived.reachedAt); assert.equal(arrivals,1);
  const outside=await recordAssistantPortalLocationPing(userId,{...fix(now+4),latitude:28.602});
  assert.equal(outside.startEligibility.eligible,false); assert.equal(arrivals,1);
  const inaccurate=await recordAssistantPortalLocationPing(userId,{...fix(now+5),accuracy:null});
  assert.equal(inaccurate.startEligibility.eligible,false); assert.equal(arrivals,1);
  const startFix=fix(now+6);
  assert.equal((await confirmAssistantPortalArrival(userId,assistantId,startFix)).startEligibility.eligible,true);
  assert.equal((await confirmAssistantPortalArrival(userId,assistantId,startFix)).startEligibility.eligible,true,'Previously uploaded fresh fix still confirms the selected task');
  assert.equal((await confirmAssistantPortalArrival(userId,assistantId,{...fix(now+7),latitude:28.602})).startEligibility.eligible,false);
  await assert.rejects(confirmAssistantPortalArrival(userId,userId,fix(now+8)),e=>e.statusCode===409);
  online=false;
  await assert.rejects(confirmAssistantPortalArrival(userId,assistantId,fix(now+9)),e=>e.statusCode===409);
  console.log('Tracking capture time, GPS quality, online/account guards, ordering, snapshot scoping and schema coalescing passed.');
} finally { pool.query = original; await pool.end(); }
