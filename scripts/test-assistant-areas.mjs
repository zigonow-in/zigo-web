import 'dotenv/config';
import assert from 'node:assert/strict';
import {pool} from '../dist/db/pool.js';
import {saveAssistantAreas} from '../dist/modules/assistant-master/assistantMaster.repository.js';
const statements=[];
const query=async(sql,args=[])=>{
  statements.push({sql,args});
  if(sql.startsWith('select id from zigo.assistants')) return {rows:[{id:'a'}]};
  if(sql.startsWith('select id, state_id')) return {rows:[{id:'city',state_id:'s'}]};
  if(sql.startsWith('select id from zigo.zones')) return {rows:[{id:'z'}]};
  if(sql.startsWith('select id, city_id')) return {rows:[{id:'c1',city_id:'city',zone_id:'z'},{id:'c2',city_id:'city',zone_id:'z'}]};
  if(sql.startsWith('select m.id,m.cluster_id')) return {rows:[{id:'m1',cluster_id:'c1'},{id:'m2',cluster_id:'c2'}]};
  if(sql.startsWith('select n.id,n.micro_market_id')) return {rows:[{id:'n1',micro_market_id:'m1'},{id:'n2',micro_market_id:'m2'}]};
  return {rows:[],rowCount:0};
};
const originalQuery=pool.query,originalConnect=pool.connect;
pool.query=query;pool.connect=async()=>({query,release(){}});
const all={stateId:'s',cityId:'city',zoneId:'z',clusters:[],microMarkets:[],nanoMarkets:[],allClusters:true,allMicroMarkets:true,allNanoMarkets:true};
try {
  await saveAssistantAreas('a',{working:all,assign:all},'actor');
  let saved=JSON.parse(statements.find(item=>item.sql.startsWith('update zigo.assistants set current_cluster_id=$2')).args[2]);
  assert.deepEqual(saved.working.clusters,['c1','c2']);assert.deepEqual(saved.assign.nanoMarkets,['n1','n2']);
  assert.deepEqual(statements.find(item=>item.sql.startsWith('insert into zigo.assistant_cluster_map')).args[1],['c1','c2']);
  statements.length=0;
  await saveAssistantAreas('a',{working:{...all,allClusters:false,clusters:['c1']},assign:all},'actor');
  saved=JSON.parse(statements.find(item=>item.sql.startsWith('update zigo.assistants set current_cluster_id=$2')).args[2]);
  assert.deepEqual(saved.assign.microMarkets,['m1']);assert.deepEqual(saved.assign.nanoMarkets,['n1']);
  statements.length=0;
  await saveAssistantAreas('a',{working:all,assign:{...all,allClusters:false,clusters:['c2']}},'actor');
  assert.equal(statements.find(item=>item.sql.startsWith('update zigo.assistants set current_cluster_id=$2')).args[1],'c2');
  for(const invalid of [
    {working:{...all,allClusters:false,clusters:[]},assign:all},
    {working:{...all,allClusters:false,clusters:['c1']},assign:{...all,allClusters:false,clusters:['c2']}},
    {working:{...all,allClusters:false,clusters:['c1'],allMicroMarkets:false,microMarkets:['m2']},assign:all},
    {working:all,assign:{...all,allMicroMarkets:false,microMarkets:['m1'],allNanoMarkets:false,nanoMarkets:['n2']}},
    {working:{...all,stateId:'wrong'},assign:all}
  ]) {
    statements.length=0;
    await assert.rejects(()=>saveAssistantAreas('a',invalid,'actor'),error=>error.status===400 || error.statusCode===400);
    assert.equal(statements.at(-1).sql,'rollback');
    assert.equal(statements.some(item=>item.sql.startsWith('update zigo.assistant_cluster_map')),false);
  }
  console.log('Assistant areas: All expansion, multiple memberships, parent/subset validation, metadata persistence and atomic rollback passed (mock database).');
} finally {pool.query=originalQuery;pool.connect=originalConnect;await pool.end();}
