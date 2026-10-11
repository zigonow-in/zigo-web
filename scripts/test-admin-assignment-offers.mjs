import 'dotenv/config';
import assert from 'node:assert/strict';
import {pool} from '../dist/db/pool.js';
import {respondAdminAssignmentOffer,expireAdminAssignmentOffers} from '../dist/modules/operations/adminAssignmentOffers.js';
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
  reset();offer.expiresAt=new Date(Date.now()-1);
  assert.equal((await respondAdminAssignmentOffer('user','assignment','accepted')).status,'expired');
  reset();offer.status='accepted';await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===409);
  reset();offer.pendingAssignmentId='replacement';await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===409);
  reset();offer=null;await assert.rejects(respondAdminAssignmentOffer('user','assignment','accepted'),e=>e.statusCode===404);
  reset();offer.expiresAt=new Date(Date.now()-1);await expireAdminAssignmentOffers();
  assert.ok(queries.some(q=>q.sql.includes('assistant_capacity_reservations set')&&q.params[1]==='released'));
  assert.ok(queries.some(q=>q.sql.includes('skip locked')));
  console.log('Offers: accept, reject, timeout, duplicate/superseded/wrong-account rejection and capacity release passed');
}finally{pool.connect=original;await pool.end();}
