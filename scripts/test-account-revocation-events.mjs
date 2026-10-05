import 'dotenv/config';
import assert from 'node:assert/strict';
import {pool} from '../dist/db/pool.js';
import {onBookingRealtimeEvent} from '../dist/modules/operations/bookingRealtime.js';
import {setUserActiveState,softDeleteUser} from '../dist/modules/users/users.repository.js';
const id='00000000-0000-4000-8000-000000000001';
const originalQuery=pool.query;const events=[];
const unsubscribe=onBookingRealtimeEvent(event=>events.push(event));
pool.query=async(sql,args=[])=>{
 const text=sql.replace(/\s+/g,' ').trim();
 if(text.startsWith('select')&&text.includes('group by u.id'))return {rows:[{id,roles:['customer'],metadata:{accountStatus:'active'},accountStatus:'active'}]};
 if(text.startsWith('update zigo.users'))return {rows:[{id}],rowCount:1};
 if(text.startsWith('insert into zigo.booking_realtime_events'))return {rows:[{id:String(events.length+1),eventType:args[0],payload:args[6],createdAt:new Date()}]};
 return {rows:[],rowCount:0};
};
try {
 await setUserActiveState(id,false,id);
 assert.equal(events.length,1);assert.equal(events[0].type,'user.session.revoked');assert.equal(events[0].payload.userId,id);
 await softDeleteUser(id,id);
 assert.equal(events.length,2);assert.equal(events[1].type,'user.session.revoked');assert.equal(events[1].payload.userId,id);
 console.log('Account revocation events: deactivation and deletion immediately publish user-targeted notifications (mock database).');
}finally{unsubscribe();pool.query=originalQuery;await pool.end();}
