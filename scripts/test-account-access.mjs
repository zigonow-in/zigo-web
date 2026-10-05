import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import {pool} from '../dist/db/pool.js';
import {env} from '../dist/config/env.js';
import {isAccountAccessBlocked} from '../dist/modules/auth/accountAccess.js';
import {authRouter} from '../dist/modules/auth/auth.routes.js';
import {requireAdminAuth} from '../dist/http/auth.js';
import {signAdminAccessToken,signAdminRefreshToken} from '../dist/modules/auth/token.service.js';
import {sendUserOtpChallenge,verifyUserOtpChallenge} from '../dist/modules/users/users.repository.js';
import {assertActivePortalSession,refreshPortalSession,verifyPortalCode,requestPortalCode,loginAssistantPortalWithPassword,verifyAssistantPasswordResetCode} from '../dist/modules/portal/portal.repository.js';

const id='00000000-0000-4000-8000-000000000001';
const passwordHash=await bcrypt.hash('test-password',4), codeHash=await bcrypt.hash('123456',4);
let role='customer', deleted=false, changed=false, roleActive=true, metadata={}, queries=[];
const originalQuery=pool.query, originalConnect=pool.connect;
function user(){return {id,userId:id,customerId:id,assistantId:id,deletedAt:null,displayName:'Test',phone:'9876543210',email:'test@example.invalid',passwordHash,metadata,accountStatus:metadata.accountStatus||'active',otpVerificationStatus:metadata.otpVerificationStatus||'not_required',otpChannelStatus:metadata.otpChannelStatus,roles:[role]};}
const query=async(sql,args=[])=>{
  const text=sql.replace(/\s+/g,' ').trim();queries.push({text,args});
  if(text.startsWith('select value, updated_at')) return {rows:[]};
  if(text.startsWith('select u.id as "userId"') && text.includes('u.deleted_at as "deletedAt"')) return {rows:[{...user(),deletedAt:deleted?new Date():null}]};
  if(text.startsWith('select u.id as "userId"')) return {rows:deleted||!roleActive?[]:[user()]};
  if(text.startsWith('select lower(r.code)')) return {rows:roleActive?[{code:role}]:[]};
  if(text.startsWith('select r.id, r.code, r.name')) return {rows:roleActive?[{id,code:role,name:role}]:[]};
  if(text.startsWith('select code from zigo.roles')) return {rows:roleActive?[{code:role}]:[]};
  if(text.startsWith('select u.metadata from zigo.users')) return {rows:deleted||!roleActive||args[1]!==role?[]:[{metadata}]};
  if(text.includes('from zigo.users') && text.startsWith('select')) return {rows:deleted?[]:[user()]};
  if(text.startsWith('update zigo.users') && text.includes('otpVerifiedAt')) {
    assert.ok(text.includes("coalesce(metadata, '{}'::jsonb) = $7::jsonb"));
    assert.deepEqual(JSON.parse(args[6]),metadata);
    if(changed||deleted)return {rows:[]};
    metadata={...metadata,accountStatus:args[1],otpVerificationStatus:args[2],otpChannelStatus:JSON.parse(args[3]),otpChallenge:JSON.parse(args[4])};
    return {rows:[{id}],rowCount:1};
  }
  if(text.startsWith('update zigo.users') && text.includes('assistantPasswordResetVerifiedAt')) {
    assert.ok(text.includes("coalesce(metadata, '{}'::jsonb) = $3::jsonb"));
    assert.deepEqual(JSON.parse(args[2]),metadata);
    if(changed||deleted)return {rows:[]};
    metadata={...metadata};delete metadata.assistantPasswordResetChallenge;
    return {rows:[{id}],rowCount:1};
  }
  return {rows:[],rowCount:0};
};
pool.query=query;pool.connect=async()=>({query,release(){}});
const app=express();app.use(express.json());app.use('/auth',authRouter);app.get('/private',requireAdminAuth,(_req,res)=>res.json({ok:true}));
app.use((error,_req,res,_next)=>res.status(error.statusCode||500).json({message:error.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const otp=()=>({otpVerifyChannels:['mobile'],otpVerificationStatus:'pending',otpChallenge:{mobile:{codeHash,expiresAt:new Date(Date.now()+60000).toISOString()}}});
const rejection=status=>error=>error.statusCode===status;
try {
  for(const status of ['inactive','deactive','deactivated','deleted','disabled','blocked','suspended']) assert.equal(isAccountAccessBlocked({accountStatus:status}),true);
  for(const flags of [{isActive:false},{isActive:'false'},{isActive:0},{isAdminDeactivated:true},{isAdminDeactivated:'true'},{deactivationSource:'admin'},{isDeleted:true}]) {
    assert.equal(isAccountAccessBlocked({accountStatus:'active',...flags}),true);
    assert.equal(isAccountAccessBlocked({accountStatus:'inactive',...otp(),...flags},true),true);
  }
  for(role of ['customer','assistant','admin','super_admin','manager','staff','owner']) {
    for(const blocked of [{accountStatus:'deactive'},{accountStatus:'inactive',isActive:false},{accountStatus:'active',isAdminDeactivated:true},{accountStatus:'disabled'},{accountStatus:'deleted'}]) {
      metadata={...otp(),...blocked};queries=[];
      await assert.rejects(()=>verifyUserOtpChallenge({userId:id,otp:'123456',actorUserId:id}),rejection(403));
      await assert.rejects(()=>sendUserOtpChallenge({userId:id,channels:['mobile'],actorUserId:id}),rejection(403));
      assert.equal(queries.some(item=>item.text.startsWith('update')),false);
    }
    deleted=true;await assert.rejects(()=>verifyUserOtpChallenge({userId:id,otp:'123456',actorUserId:id}),rejection(404));deleted=false;
  }
  role='customer';metadata={accountStatus:'inactive',...otp()};
  const verified=await verifyPortalCode({actor:role,phone:'9876543210',code:'123456'});assert.ok(verified.token);assert.equal(metadata.accountStatus,'active');
  metadata={accountStatus:'active',...otp()};
  await assert.rejects(()=>verifyUserOtpChallenge({userId:id,otp:'654321',actorUserId:id}),rejection(400));
  metadata.otpChallenge.mobile.expiresAt=new Date(Date.now()-60000).toISOString();
  await assert.rejects(()=>verifyUserOtpChallenge({userId:id,otp:'123456',actorUserId:id}),rejection(400));
  metadata={accountStatus:'active',...otp()};changed=true;
  await assert.rejects(()=>verifyUserOtpChallenge({userId:id,otp:'123456',actorUserId:id}),rejection(409));changed=false;
  for(role of ['customer','assistant']) {
    metadata={accountStatus:'active'};roleActive=true;deleted=false;
    await assertActivePortalSession(id,role);
    const refreshToken=jwt.sign({sub:id,app:`${role}_portal`,tokenType:'refresh'},env.JWT_SECRET);
    assert.ok((await refreshPortalSession({refreshToken,actor:role})).token);
    metadata={accountStatus:'active',isActive:false};
    await assert.rejects(()=>assertActivePortalSession(id,role),rejection(401));
    await assert.rejects(()=>refreshPortalSession({refreshToken,actor:role}),rejection(401));
    await assert.rejects(()=>verifyPortalCode({actor:role,phone:'9876543210',code:'123456'}),rejection(403));
    if(role==='assistant') {
      await assert.rejects(()=>loginAssistantPortalWithPassword({identifier:'9876543210',password:'test-password'}),rejection(403));
      await assert.rejects(()=>verifyAssistantPasswordResetCode({email:'test@example.invalid',code:'123456',password:'test-password'}),rejection(403));
      metadata={accountStatus:'active'};
      assert.ok((await loginAssistantPortalWithPassword({identifier:'9876543210',password:'test-password'})).token);
      const resetChallenge={codeHash,email:'test@example.invalid',expiresAt:new Date(Date.now()+60000).toISOString()};
      metadata={accountStatus:'active',assistantPasswordResetChallenge:resetChallenge};changed=true;
      await assert.rejects(()=>verifyAssistantPasswordResetCode({email:'test@example.invalid',code:'123456',password:'test-password'}),rejection(409));changed=false;
      assert.ok((await verifyAssistantPasswordResetCode({email:'test@example.invalid',code:'123456',password:'test-password'})).token);
    }
    metadata={accountStatus:'active'};roleActive=false;await assert.rejects(()=>assertActivePortalSession(id,role),rejection(401));roleActive=true;
    deleted=true;await assert.rejects(()=>assertActivePortalSession(id,role),rejection(401));deleted=false;
  }
  role='customer';deleted=true;metadata={accountStatus:'deleted'};queries=[];
  await assert.rejects(()=>requestPortalCode({actor:'customer',phone:'9876543210'}),rejection(403));
  assert.equal(queries.some(item=>item.text.startsWith('insert into zigo.users')),false);deleted=false;
  for(role of ['admin','super_admin','manager','staff']) {
    metadata={accountStatus:'active'};
    const request=(path,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
    assert.equal((await request('/auth/login',{identifier:`${role}@example.invalid`,password:'test-password'})).status,200);
    const access=signAdminAccessToken({userId:id,roles:[role]}).token;
    const refresh=signAdminRefreshToken({userId:id}).token;
    for(const blocked of [{accountStatus:'deactive'},{accountStatus:'active',isActive:false},{accountStatus:'active',isAdminDeactivated:true}]) {
      metadata=blocked;
      assert.equal((await request('/auth/login',{identifier:`${role}@example.invalid`,password:'test-password'})).status,401);
      assert.equal((await request('/auth/refresh',{refreshToken:refresh})).status,401);
      assert.equal((await request('/private',null,{Authorization:`Bearer ${access}`})).status,403);
    }
    metadata={accountStatus:'active'};deleted=true;
    assert.equal((await request('/auth/refresh',{refreshToken:refresh})).status,401);
    assert.equal((await request('/private',null,{Authorization:`Bearer ${access}`})).status,401);deleted=false;
  }
  console.log('Account access passed: all-role OTP blocking, active/onboarding login, concurrent deactivation guard, admin login/refresh/session rejection, portal session revocation and deleted-customer re-registration prevention. Mock database; no SMS sent.');
} finally {pool.query=originalQuery;pool.connect=originalConnect;await new Promise(resolve=>server.close(resolve));await pool.end();}
