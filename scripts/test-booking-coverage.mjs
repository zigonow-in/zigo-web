import 'dotenv/config';
import assert from 'node:assert/strict';
import { pool } from '../dist/db/pool.js';
import { validateBookingLocation, createBookingByAdmin } from '../dist/modules/operations/operations.repository.js';
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const polygon = 'POLYGON ((0 0,4 0,4 4,0 4,0 0))';
const cluster = (id, name) => ({ id, name, polygonDescription: polygon, zonePolygonDescription: polygon, zoneIsOpen: true, metadata: {} });
let clusters = [cluster(a, 'Pinned'), cluster(b, 'Selected')], closedMarket = new Set();
const query = pool.query, connect = pool.connect;
pool.query = async (sql, args = []) => {
  if (sql.includes('from zigo.customers c') && sql.includes('u.display_name')) return { rows: [{ id: a, status: 'active' }] };
  if (sql.includes('from zigo.clusters cl')) return { rows: clusters };
  if (sql.includes('from zigo.micro_markets m')) return { rows: closedMarket.has(args[0]) ? [{ isOpen: false, polygonDescription: polygon, children: [] }] : [] };
  if (sql.includes('city.service_region_code')) return { rows: [...new Set(args[0])].map(id => ({ id, city_id: a })) };
  throw Error(`Unexpected query: ${sql.slice(0, 100)}`);
};
pool.connect = async () => { throw Error('Validated booking transaction reached'); };
const location = { customerId: a, latitude: 2, longitude: 2, address: 'Test location' };
const booking = { ...location, clusterId: b, estimatedAmountPaise: 9900, durationMinutes: 30, actorUserId: a,
  metadata: { bookingLocations: { stops: [{ ...location, clusterId: b, sequence: 1 }] } } };
try {
  assert.equal((await validateBookingLocation(location)).cluster.clusterId, a);
  assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).cluster.clusterId, b, 'Valid overlapping selection is preserved');
  await assert.rejects(createBookingByAdmin(booking), /Validated booking transaction reached/, 'Valid overlap reaches creation rather than 409');
  clusters[1].zoneIsOpen = false;
  assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).cluster.clusterId, a, 'Closed zone is never preferred');
  await assert.rejects(createBookingByAdmin(booking), e => e.statusCode === 409);
  clusters[1].zoneIsOpen = true; closedMarket.add(b);
  assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).cluster.clusterId, a, 'Closed child market is never preferred');
  await assert.rejects(createBookingByAdmin(booking), e => e.statusCode === 409);
  closedMarket.clear(); clusters[1].polygonDescription = 'POLYGON ((10 10,14 10,14 14,10 14,10 10))';
  await assert.rejects(createBookingByAdmin(booking), e => e.statusCode === 409, 'Changed coverage remains a conflict');
  clusters = []; assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).isServiceable, false);
  await assert.rejects(createBookingByAdmin(booking), e => e.statusCode === 400);
  console.log('Overlapping cluster confirmation, preferred coverage, closed zones/markets, changed boundaries and unserviceable locations passed.');
} finally { pool.query = query; pool.connect = connect; await pool.end(); }
