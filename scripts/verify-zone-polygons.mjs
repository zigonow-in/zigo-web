import assert from 'node:assert/strict';
import { pool } from '../dist/db/pool.js';
import { listZonePolygons } from '../dist/modules/masters/locationHierarchy.repository.js';
try {
  const zones = await pool.query('select id from zigo.zones where coalesce(is_deleted,false)=false limit 3');
  for (const zone of zones.rows) {
    const records = await listZonePolygons(zone.id);
    assert.equal(records.filter(row => row.level === 'zones').length, 1);
    assert.equal(records.find(row => row.level === 'zones').id, zone.id);
    const clusters = await pool.query('select id from zigo.clusters where zone_id=$1 and coalesce(is_deleted,false)=false', [zone.id]);
    const markets = await pool.query('select id from zigo.micro_markets where cluster_id=any($1::uuid[]) and coalesce(is_deleted,false)=false', [clusters.rows.map(row => row.id)]);
    const nanos = await pool.query('select id from zigo.nano_markets where micro_market_id=any($1::uuid[]) and coalesce(is_deleted,false)=false', [markets.rows.map(row => row.id)]);
    for (const [level, expected] of [['clusters',clusters],['micro-markets',markets],['nano-markets',nanos]]) {
      assert.deepEqual(records.filter(row => row.level === level).map(row => row.id).sort(), expected.rows.map(row => row.id).sort());
    }
  }
  await assert.rejects(listZonePolygons('00000000-0000-0000-0000-000000000000'), error => error.statusCode === 404);
  console.log(`Zone ownership, descendant selection and missing-zone checks passed (${zones.rows.length} zones).`);
} finally { await pool.end(); }
