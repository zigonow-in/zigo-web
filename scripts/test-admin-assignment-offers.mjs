import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pool} from '../dist/db/pool.js';
import {ADMIN_ASSIGNMENT_OFFER_RESPONSE_GRACE_MS,respondAdminAssignmentOffer,expireAdminAssignmentOffers} from '../dist/modules/operations/adminAssignmentOffers.js';
const original=pool.connect;
let offer,queries;
const reset=()=>{queries=[];offer={id:'assignment',bookingId:'booking',assistantId:'assistant',status:'offered',metadata:{adminOffer:true,expectedFreeAt:new Date(Date.now()+3600000).toISOString()},expiresAt:new Date(Date.now()+30000),pendingAssignmentId:'assignment',acceptedAssignmentId:null,bookingStatus:'assigned'};};
pool.connect=async()=>({release(){},async query(sql,params=[]){
  queries.push({sql,params});
  if(sql.includes('a.user_id=$2')) {assert.equal(params[1],'user');return {rows:offer ? [offer] : []};}
  if(sql.includes('skip locked')) return {rows:[offer]};
  return {rows:[],rowCount:1};
}});
try {
  reset(); assert.equal((await respondAdminAssignmentOffer('user','assignment','accepted')).status,'accepted');
  assert.ok(queries.some(q=>q.sql.includes('assistant_capacity_reservations set')&&q.params[1]==='assigned'));
  assert.ok(queries.some(q=>q.sql.includes('update zigo.service_requests')&&q.params[2]==='accepted'));
  reset(); assert.equal((await respondAdminAssignmentOffer('user','assignment','rejected')).status,'rejected');
  assert.ok(queries.some(q=>q.sql.includes('assistant_capacity_reservations set')&&q.params[1]==='released'));
  assert.ok(queries.some(q=>q.sql.includes('update zigo.service_requests')&&q.params[2]==='queued'));
  reset();offer.expiresAt=new Date(Date.now()-1000);
  assert.equal((await respondAdminAssignmentOffer('user','assignment','accepted')).status,'accepted');
  reset();offer.expiresAt=new Date(Date.now()-ADMIN_ASSIGNMENT_OFFER_RESPONSE_GRACE_MS-10);
  assert.equal((await respondAdminAssignmentOffer('user','assignment','accepted')).status,'expired');
  reset();offer.status='accepted';await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===409);
  reset();offer.pendingAssignmentId='replacement';await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===409);
  reset();offer=null;await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===404);
  reset();offer.expiresAt=new Date(Date.now()-ADMIN_ASSIGNMENT_OFFER_RESPONSE_GRACE_MS-10);await expireAdminAssignmentOffers();
  assert.ok(queries.some(q=>q.sql.includes('assistant_capacity_reservations set')&&q.params[1]==='released'));
  assert.ok(queries.some(q=>q.sql.includes('skip locked')));
  assert.ok(queries.some(q=>q.sql.includes("interval '1 millisecond'")&&q.params[0]===ADMIN_ASSIGNMENT_OFFER_RESPONSE_GRACE_MS));
  const portal=readFileSync(new URL('../public/portal.js',import.meta.url),'utf8');
  const portalRepository=readFileSync(new URL('../src/modules/portal/portal.repository.ts',import.meta.url),'utf8');
  const bookingEngine=readFileSync(new URL('../src/modules/operations/bookingEngine.ts',import.meta.url),'utf8');
  const operationsRepository=readFileSync(new URL('../src/modules/operations/operations.repository.ts',import.meta.url),'utf8');
  assert.match(portal,/function assistantTaskIsActiveBroadcastOffer\(task = \{\}, now = portalServerNowMs\(\)\)/);
  assert.match(portal,/syncPortalServerClock\(mePayload\.data\.serverNow\)/);
  assert.match(portal,/if\(!task \|\| !assistantTaskIsActiveBroadcastOffer\(task\)\)/);
  assert.match(portal,/function scheduleAssistantOfferExpiry/);
  assert.match(portalRepository,/serverNow: new Date\(\)\.toISOString\(\)/);
  assert.match(bookingEngine,/nullif\(sr\.metadata->>'pendingAssignmentId', ''\)::uuid/);
  assert.match(bookingEngine,/ta\.expires_at \+ \(\$3::int \* interval '1 millisecond'\) > now\(\)/);
  assert.match(operationsRepository,/new Date\(assignmentExpiry\.getTime\(\) \+ ADMIN_ASSIGNMENT_OFFER_RESPONSE_GRACE_MS\)/);
  console.log('Offers: accept, boundary grace, reject, timeout, duplicate/superseded/wrong-account rejection and capacity release passed');
}finally{pool.connect=original;await pool.end();}
