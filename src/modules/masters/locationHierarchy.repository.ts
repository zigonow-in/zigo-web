import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { parseWktPolygon, isPointInPolygon } from "../../utils/geofence.js";
import type { PoolClient } from "pg";

const levels = {
  zones: { table: "zones", parent: "cities", parentColumn: "city_id", openColumn: "is_open", children: "clusters", childColumn: "zone_id" },
  clusters: { table: "clusters", parent: "zones", parentColumn: "zone_id", openColumn: "is_booking_enabled", children: "micro_markets", childColumn: "cluster_id" },
  "micro-markets": { table: "micro_markets", parent: "clusters", parentColumn: "cluster_id", openColumn: "is_open", children: "nano_markets", childColumn: "micro_market_id" },
  "nano-markets": { table: "nano_markets", parent: "micro_markets", parentColumn: "micro_market_id", openColumn: "is_open", children: null, childColumn: null }
} as const;

export type LocationLevel = keyof typeof levels;
type LocationInput = { parentId: string; name: string; code: string; polygonDescription: string; isOpen: boolean; userId: string; marketTypeId?: string | null; marketTypeIds?: string[] };

const nanoTypesSql = (alias: string) => `(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color,'isActive',t.is_active and not t.is_deleted) order by nt.sort_order,t.id),'[]'::jsonb)
  from zigo.nano_market_types nt join zigo.market_types t on t.id=nt.market_type_id where nt.nano_market_id=${alias}.id)`;
function withMarketColors(row: any) {
  if (!row.marketTypes) return row;
  return {...row,marketTypeIds:row.marketTypes.map((type: {id: string})=>type.id),polygonColor:row.marketTypes[0]?.color || '#dc2626'};
}

async function locationTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    if ((error as { code?: string }).code === "23505") throw new HttpError(409, "This location code already exists under the selected parent.");
    throw error;
  } finally { client.release(); }
}

export function pointInOpenMarkets(markets: Array<{ isOpen: boolean; polygonDescription: string; children?: Array<{ isOpen: boolean; polygonDescription: string }> }>, latitude: number, longitude: number): boolean {
  if (!markets.length) return true;
  const matching = markets.filter((market) => isPointInPolygon(latitude, longitude, parseWktPolygon(market.polygonDescription)));
  return matching.length > 0 && matching.every((market) => market.isOpen && pointInOpenMarkets(market.children || [], latitude, longitude));
}

export async function locationMarketsAreOpen(clusterId: string, latitude: number, longitude: number) {
  const result = await pool.query(`select (m.is_open and m.is_active) as "isOpen", m.polygon_description as "polygonDescription",
      coalesce((select jsonb_agg(jsonb_build_object('isOpen', n.is_open and n.is_active, 'polygonDescription', n.polygon_description))
        from zigo.nano_markets n where n.micro_market_id = m.id and n.is_deleted = false), '[]'::jsonb) as children
    from zigo.micro_markets m where m.cluster_id = $1 and m.is_deleted = false`, [clusterId]);
  return pointInOpenMarkets(result.rows, latitude, longitude);
}

export async function locationClustersCanInterserve(clusterIds: string[]) {
  const ids = [...new Set(clusterIds.filter(Boolean))];
  if (!ids.length) return false;
  const result = await pool.query(`select c.id, c.city_id, city.service_region_code, city.allow_intercity_service from zigo.clusters c
    join zigo.cities city on city.id = c.city_id
    left join zigo.zones z on z.id = c.zone_id
    left join zigo.states s on s.id = city.state_id
    where c.id = any($1::uuid[]) and coalesce(c.is_deleted, false) = false and c.is_booking_enabled = true
      and city.is_active = true and coalesce(city.is_deleted, false) = false
      and coalesce(s.is_active, true) = true and coalesce(s.is_deleted, false) = false
      and (c.zone_id is null or (z.is_open = true and z.is_active = true and coalesce(z.is_deleted, false) = false))`, [ids]);
  if (result.rows.length !== ids.length) return false;
  if (new Set(result.rows.map((row) => row.city_id)).size === 1) return true;
  const regions = new Set(result.rows.map((row) => row.service_region_code));
  return regions.size === 1 && Boolean(result.rows[0]?.service_region_code) && result.rows.every((row) => row.allow_intercity_service === true);
}

export async function listLocationHierarchy(level: LocationLevel) {
  const config = levels[level];
  const result = await pool.query(`
    select item.id, item.name, item.code, item.${config.parentColumn} as "parentId",
      parent.name as "parentName", item.polygon_description as "polygonDescription",
      item.${config.openColumn} as "isOpen"
      ${level === "nano-markets" ? `, item.market_type_id as "marketTypeId", ${nanoTypesSql('item')} as "marketTypes"` : ''}
    from zigo.${config.table} item
    left join zigo.${config.parent} parent on parent.id = item.${config.parentColumn}
    where coalesce(item.is_deleted, false) = false
    order by parent.name, item.name
  `);
  return result.rows.map(withMarketColors);
}

export async function listZonePolygons(zoneId: string) {
  const result = await pool.query(`
    with zone as (select id, name, polygon_description from zigo.zones where id = $1 and coalesce(is_deleted, false) = false),
    clusters as (select c.id, c.name, c.polygon_description from zigo.clusters c join zone z on z.id = c.zone_id where coalesce(c.is_deleted, false) = false),
    micro_markets as (select m.id, m.name, m.polygon_description from zigo.micro_markets m join clusters c on c.id = m.cluster_id where coalesce(m.is_deleted, false) = false)
    select id, name, polygon_description as "polygonDescription", 'zones' as level, null::jsonb as "marketTypes" from zone
    union all select id, name, polygon_description, 'clusters', null::jsonb from clusters
    union all select id, name, polygon_description, 'micro-markets', null::jsonb from micro_markets
    union all select n.id, n.name, n.polygon_description, 'nano-markets', ${nanoTypesSql('n')} from zigo.nano_markets n
      join micro_markets m on m.id = n.micro_market_id where coalesce(n.is_deleted, false) = false
  `, [zoneId]);
  if (!result.rows.length) throw new HttpError(404, "Zone not found.");
  return result.rows.map(withMarketColors);
}

export async function saveLocationHierarchy(level: LocationLevel, input: LocationInput, id?: string) {
  return locationTransaction(async (client) => {
  const config = levels[level];
  const parent = await client.query(`select id${level === "clusters" ? ", city_id" : ""} from zigo.${config.parent} where id = $1 and coalesce(is_deleted, false) = false for share`, [input.parentId]);
  if (!parent.rows[0]) throw new HttpError(400, "Select a valid parent location.");
  let marketTypeIds: string[] = [];
  if (level === "nano-markets") {
    const previous = id ? await client.query(`select market_type_id from zigo.nano_market_types where nano_market_id=$1 order by sort_order,market_type_id`,[id]) : null;
    const previousIds: string[] = previous?.rows.map(row=>row.market_type_id) || [];
    marketTypeIds = [...new Set(input.marketTypeIds ?? (input.marketTypeId !== undefined ? (input.marketTypeId ? [input.marketTypeId] : []) : previousIds))];
    if (marketTypeIds.length) {
      const types = await client.query(`select id,is_active,is_deleted from zigo.market_types where id=any($1::uuid[]) for share`,[marketTypeIds]);
      if (types.rows.length !== marketTypeIds.length || types.rows.some(row=>(!row.is_active || row.is_deleted) && !previousIds.includes(row.id))) throw new HttpError(400,"Select active Market Types.");
    }
  }
  const boundary = input.polygonDescription.trim().match(/^POLYGON\s*\(\s*\((.+)\)\s*\)$/i);
  const coordinatePairs = boundary?.[1].split(",").map((pair) => pair.trim().split(/\s+/).map(Number)) || [];
  const polygon = parseWktPolygon(input.polygonDescription);
  const distinctVertices = new Set(coordinatePairs.map((pair) => pair.join(",")));
  if (polygon.length < 4 || distinctVertices.size < 3 || coordinatePairs.some((pair) => pair.length !== 2 || !pair.every(Number.isFinite)) || polygon.some(([longitude, latitude]) => longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)) throw new HttpError(400, "Enter a valid polygon boundary in WKT format.");
  const values: unknown[] = [input.parentId, input.name, input.code, input.polygonDescription, input.isOpen, input.userId];
  let result;
  if (id) {
    const existing = await client.query(`select ${config.parentColumn} as "parentId" from zigo.${config.table} where id = $1 and coalesce(is_deleted, false) = false for update`, [id]);
    if (!existing.rows[0]) return null;
    if (config.children && existing.rows[0].parentId !== input.parentId) {
      const children = await client.query(`select id from zigo.${config.children} where ${config.childColumn} = $1 and coalesce(is_deleted, false) = false limit 1`, [id]);
      if (children.rows.length) throw new HttpError(409, "Move the child locations before changing this parent.");
    }
    values.push(id);
    if (level === "clusters") values.push(parent.rows[0].city_id);
    if (level === "nano-markets") values.push(marketTypeIds[0] ?? null);
    result = await client.query(`update zigo.${config.table}
      set ${config.parentColumn} = $1, name = $2, code = $3, polygon_description = $4,
        ${config.openColumn} = $5, updated_by = $6, updated_at = now()
        ${level === "clusters" ? ", city_id = $8" : ""}
        ${level === "nano-markets" ? ", market_type_id = $8" : ""}
      where id = $7 and coalesce(is_deleted, false) = false returning id`, values);
  } else {
    if (level === "clusters") values.push(parent.rows[0].city_id);
    if (level === "nano-markets") values.push(marketTypeIds[0] ?? null);
    result = await client.query(`insert into zigo.${config.table}
      (${config.parentColumn}, name, code, polygon_description, ${config.openColumn}, created_by, updated_by${level === "clusters" ? ", city_id" : ""}${level === "nano-markets" ? ", market_type_id" : ""})
      values ($1, $2, $3, $4, $5, $6, $6${level === "clusters" || level === "nano-markets" ? ", $7" : ""}) returning id`, values);
  }
  const saved = result.rows[0] ?? null;
  if (saved && level === "nano-markets") {
    await client.query(`delete from zigo.nano_market_types where nano_market_id=$1`,[saved.id]);
    await client.query(`insert into zigo.nano_market_types(nano_market_id,market_type_id,sort_order) select $1,type_id,position-1 from unnest($2::uuid[]) with ordinality as types(type_id,position)`,[saved.id,marketTypeIds]);
  }
  return saved;
  });
}

export async function deleteLocationHierarchy(level: LocationLevel, id: string, userId: string) {
  return locationTransaction(async (client) => {
  const config = levels[level];
  const existing = await client.query(`select id from zigo.${config.table} where id = $1 and coalesce(is_deleted, false) = false for update`, [id]);
  if (!existing.rows[0]) return null;
  if (config.children) {
    const children = await client.query(`select id from zigo.${config.children} where ${config.childColumn} = $1 and coalesce(is_deleted, false) = false limit 1`, [id]);
    if (children.rows.length) throw new HttpError(409, "Remove the child locations before deleting this location.");
  }
  const result = await client.query(`update zigo.${config.table} set is_deleted = true, deleted_at = now(), deleted_by = $2, updated_by = $2, updated_at = now() where id = $1 and coalesce(is_deleted, false) = false returning id`, [id, userId]);
  return result.rows[0] ?? null;
  });
}
