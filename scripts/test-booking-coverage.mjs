import 'dotenv/config';
import assert from 'node:assert/strict';
import { pool } from '../dist/db/pool.js';
import { validateBookingLocation, createBookingByAdmin } from '../dist/modules/operations/operations.repository.js';
import { isPointInPolygon, parseWktPolygon } from '../dist/utils/geofence.js';
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const polygon = 'POLYGON ((0 0,4 0,4 4,0 4,0 0))';
const outsidePolygon = 'POLYGON ((10 10,14 10,14 14,10 14,10 10))';
const cluster = (id, name) => ({ id, name, zoneId: a, zoneName: 'Test Zone', polygonDescription: polygon, zonePolygonDescription: polygon, zoneIsOpen: true, metadata: {} });
let clusters = [cluster(a, 'Pinned'), cluster(b, 'Selected')];
const query = pool.query, connect = pool.connect;
pool.query = async (sql, args = []) => {
  if (sql.includes('from zigo.customers c') && sql.includes('u.display_name')) return { rows: [{ id: a, status: 'active' }] };
  if (sql.includes('from zigo.clusters cl')) return { rows: clusters };
  if (sql.includes('city.service_region_code')) return { rows: [...new Set(args[0])].map(id => ({ id, city_id: a })) };
  throw Error(`Unexpected query: ${sql.slice(0, 100)}`);
};
pool.connect = async () => { throw Error('Validated booking transaction reached'); };
const location = { customerId: a, latitude: 2, longitude: 2, address: 'Test location' };
const booking = { ...location, clusterId: b, estimatedAmountPaise: 9900, durationMinutes: 30, actorUserId: a,
  metadata: { bookingLocations: { stops: [{ ...location, clusterId: b, sequence: 1 }] } } };
try {
  const coordinates = parseWktPolygon(polygon);
  assert.equal(isPointInPolygon(2, 2, coordinates), true, 'Point inside the zone is accepted');
  assert.equal(isPointInPolygon(0, 2, coordinates), true, 'Point touching a zone edge is accepted');
  assert.equal(isPointInPolygon(0, 0, coordinates), true, 'Point touching a zone vertex is accepted');
  assert.equal(isPointInPolygon(-0.001, 2, coordinates), false, 'Point outside the zone is rejected');
  assert.equal((await validateBookingLocation({ ...location, latitude: 0 })).isServiceable, true, 'Zone boundary is serviceable');
  assert.equal((await validateBookingLocation(location)).cluster.clusterId, a);
  assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).cluster.clusterId, b, 'Preferred operational cluster is preserved');
  await assert.rejects(createBookingByAdmin(booking), /Validated booking transaction reached/, 'Valid Zone reaches booking creation');
  clusters.forEach(item => { item.polygonDescription = outsidePolygon; });
  assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).cluster.clusterId, b, 'Cluster polygons do not affect serviceability');
  await assert.rejects(createBookingByAdmin(booking), /Validated booking transaction reached/, 'Cluster geometry does not reject booking creation');
  clusters.forEach(item => { item.zoneIsOpen = false; });
  assert.equal((await validateBookingLocation(location)).isServiceable, false, 'Closed Zone is not serviceable');
  clusters.forEach(item => { item.zoneIsOpen = true; });
  clusters.forEach(item => { item.zonePolygonDescription = null; });
  assert.equal((await validateBookingLocation(location)).isServiceable, false, 'Missing Zone geometry is never serviceable');
  clusters.forEach(item => { item.zonePolygonDescription = outsidePolygon; });
  assert.equal((await validateBookingLocation(location)).isServiceable, false, 'Point outside the Zone is not serviceable');
  await assert.rejects(createBookingByAdmin(booking), error => error.statusCode === 400, 'Outside-Zone booking is rejected');
  clusters = []; assert.equal((await validateBookingLocation({ ...location, preferredClusterId: b })).isServiceable, false);
  await assert.rejects(createBookingByAdmin(booking), e => e.statusCode === 400);
  console.log('Zone-only coverage, boundary inclusion, cluster-independence and outside-Zone rejection passed.');
} finally { pool.query = query; pool.connect = connect; await pool.end(); }
