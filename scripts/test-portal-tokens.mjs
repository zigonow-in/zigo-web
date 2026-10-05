import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {pool} from '../dist/db/pool.js';
import {env} from '../dist/config/env.js';
import {portalRouter} from '../dist/modules/portal/portal.routes.js';
import {refreshPortalSession,verifyPortalToken} from '../dist/modules/portal/portal.repository.js';
import {notFoundHandler} from '../dist/http/errors.js';

const id='00000000-0000-4000-8000-000000000001';
let reads=0,active=true,dbFailure=false;
const originalQuery=pool.query;
const databaseError=new Error('Simulated database failure');
pool.query=async()=>{reads++;if(dbFailure)throw databaseError;return {rows:active?[{metadata:{accountStatus:'active'}}]:[]};};
const app=express();app.use(express.json());app.use('/portal',portalRouter);app.use(notFoundHandler);
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const request=async(actor,refreshToken)=>{
  const response=await fetch(`${base}/portal/${actor}/session/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken})});
  return {status:response.status,body:await response.json()};
};
try {
  for(const actor of ['customer','assistant']) {
    const payload={sub:id,app:`${actor}_portal`,tokenType:'refresh'};
    const invalid=[
      'invalid-refresh-token-for-test',
      jwt.sign(payload,env.JWT_SECRET,{expiresIn:-1}),
      jwt.sign(payload,'different-test-signing-secret'),
      jwt.sign({...payload,sub:'not-a-uuid'},env.JWT_SECRET),
      jwt.sign({app:payload.app,tokenType:'refresh'},env.JWT_SECRET),
      jwt.sign({...payload,tokenType:'access'},env.JWT_SECRET),
      jwt.sign({...payload,app:actor==='customer'?'assistant_portal':'customer_portal'},env.JWT_SECRET)
    ];
    reads=0;
    for(const token of invalid) {
      const response=await request(actor,token);
      assert.equal(response.status,401);assert.equal(response.body.error.statusCode,401);
      assert.equal(response.body.data,undefined);
    }
    assert.equal(reads,0,'Invalid tokens must not query the database');
    for(const token of invalid.slice(0,5)) assert.throws(()=>verifyPortalToken(token,actor),error=>error.statusCode===401);
    const valid=jwt.sign(payload,env.JWT_SECRET,{expiresIn:'1h'});
    assert.equal((await request(actor,valid)).status,200);
    active=false;assert.equal((await request(actor,valid)).status,401);active=true;
    dbFailure=true;
    await assert.rejects(()=>refreshPortalSession({actor,refreshToken:valid}),error=>error===databaseError);
    dbFailure=false;
  }
  console.log('Portal token tests passed: malformed, expired, wrong-signature, invalid-subject, wrong-type/actor tokens return HTTP 401; valid refresh works; revoked accounts rejected; database errors are not masked. Mock database.');
}finally{pool.query=originalQuery;await new Promise(resolve=>server.close(resolve));await pool.end();}
