import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../dist/db/pool.js";
import { saveLocationHierarchy, listLocationHierarchy, deleteLocationHierarchy, locationMarketsAreOpen, locationClustersCanInterserve } from "../dist/modules/masters/locationHierarchy.repository.js";

if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Integration verification requires a local database.");
const created = { cities: [], zones: [], clusters: [], micro_markets: [], nano_markets: [], market_types: [] };
const polygonDescription = "POLYGON((0 0, 4 0, 4 4, 0 4, 0 0))";
try {
  const actor = await pool.query("select id from zigo.users where deleted_at is null limit 1");
  assert.ok(actor.rows[0], "An existing user is required for audit references");
  const userId = actor.rows[0].id;
  for (let index = 0; index < 2; index++) {
    const id = randomUUID();
    await pool.query("insert into zigo.cities(id, name, code) values ($1, $2, $3)", [id, "Hierarchy verification", `test_${id}`]);
    created.cities.push(id);
  }
  const make = async (level, parentId) => {
    const input = { parentId, name: "Hierarchy verification", code: `test_${randomUUID()}`, polygonDescription, isOpen: true, userId };
    const record = await saveLocationHierarchy(level, input);
    created[level.replaceAll("-", "_")].push(record.id);
    return { id: record.id, input };
  };
  const zone = await make("zones", created.cities[0]);
  const cluster = await make("clusters", zone.id);
  const micro = await make("micro-markets", cluster.id);
  const nano = await make("nano-markets", micro.id);
  const marketTypeId = randomUUID();
  await pool.query("insert into zigo.market_types(id,name,code,color) values ($1,'Verification type',$2,'#16a34a')", [marketTypeId, `test_${marketTypeId}`]);
  created.market_types.push(marketTypeId);
  await saveLocationHierarchy("nano-markets", { ...nano.input, marketTypeId }, nano.id);
  assert.equal((await listLocationHierarchy("nano-markets")).find(record => record.id === nano.id).marketTypeId, marketTypeId);
  const secondTypeId = randomUUID();
  await pool.query("insert into zigo.market_types(id,name,code,color) values ($1,'Second verification type',$2,'#0000ff')", [secondTypeId, `test_${secondTypeId}`]);
  created.market_types.push(secondTypeId);
  await pool.query("update zigo.market_types set color='#ff0000' where id=$1", [marketTypeId]);
  await saveLocationHierarchy("nano-markets", { ...nano.input, marketTypeIds: [marketTypeId,secondTypeId,marketTypeId] }, nano.id);
  let stored = (await listLocationHierarchy('nano-markets')).find(record=>record.id===nano.id);
  assert.deepEqual(stored.marketTypeIds.slice().sort(), [marketTypeId,secondTypeId].sort());
  assert.equal(stored.polygonColor, '#ff0000');
  assert.deepEqual(stored.marketTypeIds,[marketTypeId,secondTypeId],'Selection order is preserved');
  await saveLocationHierarchy("nano-markets", { ...nano.input }, nano.id);
  assert.equal((await listLocationHierarchy('nano-markets')).find(record=>record.id===nano.id).marketTypeIds.length,2,'Omitted selection preserves existing types');
  await assert.rejects(() => saveLocationHierarchy("nano-markets", { ...nano.input, marketTypeIds: [randomUUID()] }, nano.id), /active Market Types/);
  await pool.query("update zigo.market_types set is_active=false where id=$1", [marketTypeId]);
  await saveLocationHierarchy("nano-markets", { ...nano.input, marketTypeId }, nano.id);
  await assert.rejects(() => saveLocationHierarchy("nano-markets", { ...nano.input, code: `test_${randomUUID()}`, marketTypeId }), /active Market Types/);
  await saveLocationHierarchy("nano-markets", { ...nano.input, marketTypeId: null }, nano.id);
  assert.equal((await listLocationHierarchy("nano-markets")).find(record => record.id === nano.id).marketTypeId, null);
  stored = (await listLocationHierarchy('nano-markets')).find(record=>record.id===nano.id);
  assert.deepEqual(stored.marketTypeIds,[]); assert.equal(stored.polygonColor,'#dc2626');
  assert.ok((await listLocationHierarchy("nano-markets")).some((record) => record.id === nano.id && record.parentId === micro.id));
  assert.equal(await locationMarketsAreOpen(cluster.id, 2, 2), true);
  await saveLocationHierarchy("nano-markets", { ...nano.input, isOpen: false }, nano.id);
  assert.equal(await locationMarketsAreOpen(cluster.id, 2, 2), false);
  assert.equal(await locationMarketsAreOpen(cluster.id, 8, 8), false);
  await assert.rejects(() => deleteLocationHierarchy("micro-markets", micro.id, userId), { statusCode: 409 });
  await assert.rejects(() => saveLocationHierarchy("nano-markets", { ...nano.input, polygonDescription: "POLYGON((bad 0, 4 0, 4 4, 0 4, bad 0))" }), /valid polygon/);
  const secondZone = await make("zones", created.cities[0]);
  const secondCluster = await make("clusters", secondZone.id);
  assert.equal(await locationClustersCanInterserve([cluster.id, secondCluster.id]), true);
  await saveLocationHierarchy("zones", { ...secondZone.input, isOpen: false }, secondZone.id);
  assert.equal(await locationClustersCanInterserve([cluster.id, secondCluster.id]), false);
  const otherCityZone = await make("zones", created.cities[1]);
  const otherCityCluster = await make("clusters", otherCityZone.id);
  assert.equal(await locationClustersCanInterserve([cluster.id, otherCityCluster.id]), false);
  await pool.query("update zigo.cities set service_region_code = 'hierarchy-verification', allow_intercity_service = true where id = any($1::uuid[])", [created.cities]);
  assert.equal(await locationClustersCanInterserve([cluster.id, otherCityCluster.id]), true);
  console.log("Hierarchy CRUD, Open checks, parent deletion protection, same-city and region rules verified.");
} finally {
  for (const table of ["nano_markets", "micro_markets", "clusters", "zones", "cities", "market_types"]) {
    if (created[table].length) await pool.query(`delete from zigo.${table} where id = any($1::uuid[])`, [created[table]]);
  }
  await pool.end();
}
