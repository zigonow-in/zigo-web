import { pool } from "../../db/pool.js";
export const ADDON_CHARGE_TYPES = ["delivery", "packaging", "service", "platform", "weather", "handling"];
export const ADDON_APPLICABILITY = ["all_customer", "new_customer", "old_customer"];
export const ADDON_COST_TYPES = ["percent", "flat"];
export const ADDON_PERCENT_BASES = ["task_base_price", "selling_price", "customer_price"];
export const ADDON_SCOPE_TYPES = ["all", "state", "city", "zone", "cluster", "micro_market", "nano_market"];
let schemaReady = null;
export async function ensureAddOnChargeSchema() {
    if (!schemaReady) {
        schemaReady = pool.query(`
      create table if not exists zigo.addon_charge_masters (
        id uuid primary key default gen_random_uuid(),
        addon_type text not null default 'service',
        scope text not null default 'all',
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        micro_market_id uuid references zigo.micro_markets(id),
        nano_market_id uuid references zigo.nano_markets(id),
        title text not null,
        description text,
        label text not null,
        applicable_on text not null default 'all_customer',
        cost_type text not null default 'flat',
        cost_value numeric(12,2) not null default 0,
        percentage_base text not null default 'selling_price',
        customer_price numeric(12,2),
        discount_slabs jsonb not null default '[]'::jsonb,
        delivery_distance_slabs jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false,
        constraint addon_charge_type_check check (addon_type in ('delivery','packaging','service','platform','weather','handling')),
        constraint addon_charge_applicable_on_check check (applicable_on in ('all_customer','new_customer','old_customer')),
        constraint addon_charge_cost_type_check check (cost_type in ('percent','flat')),
        constraint addon_charge_percentage_base_check check (percentage_base in ('task_base_price','selling_price','customer_price'))
      );
      alter table zigo.addon_charge_masters
        add column if not exists addon_type text not null default 'service',
        add column if not exists scope text not null default 'all',
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists micro_market_id uuid references zigo.micro_markets(id),
        add column if not exists nano_market_id uuid references zigo.nano_markets(id),
        add column if not exists title text not null default '',
        add column if not exists description text,
        add column if not exists label text not null default '',
        add column if not exists applicable_on text not null default 'all_customer',
        add column if not exists cost_type text not null default 'flat',
        add column if not exists cost_value numeric(12,2) not null default 0,
        add column if not exists percentage_base text not null default 'selling_price',
        add column if not exists customer_price numeric(12,2),
        add column if not exists discount_slabs jsonb not null default '[]'::jsonb,
        add column if not exists delivery_distance_slabs jsonb not null default '[]'::jsonb,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_addon_charge_masters_active
        on zigo.addon_charge_masters(is_deleted, is_active, addon_type, updated_at desc);
      create index if not exists idx_addon_charge_masters_location_scope
        on zigo.addon_charge_masters(scope_type, state_id, city_id, zone_id, cluster_id, micro_market_id, nano_market_id);
      create table if not exists zigo.booking_addon_charge_lines (
        id uuid primary key default gen_random_uuid(),
        service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
        addon_charge_master_id uuid references zigo.addon_charge_masters(id),
        addon_type text not null,
        scope text not null default 'all',
        scope_type text not null default 'all',
        state_id uuid,
        city_id uuid,
        zone_id uuid,
        cluster_id uuid,
        micro_market_id uuid,
        nano_market_id uuid,
        title text not null,
        label text not null,
        customer_applicability text not null default 'all_customer',
        cost_type text not null default 'flat',
        percentage_base text,
        base_amount_paise bigint not null default 0,
        gross_amount_paise bigint not null default 0,
        discount_type text not null default 'none',
        discount_value numeric(12,2) not null default 0,
        discount_amount_paise bigint not null default 0,
        net_amount_paise bigint not null default 0,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      alter table zigo.booking_addon_charge_lines
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid,
        add column if not exists city_id uuid,
        add column if not exists zone_id uuid,
        add column if not exists cluster_id uuid,
        add column if not exists micro_market_id uuid,
        add column if not exists nano_market_id uuid,
        add column if not exists raw_gross_amount_paise bigint not null default 0,
        add column if not exists raw_net_amount_paise bigint not null default 0,
        add column if not exists taxable_after_discount_paise bigint not null default 0,
        add column if not exists amount_after_discount_paise bigint not null default 0,
        add column if not exists inclusive_tax_amount_paise bigint not null default 0,
        add column if not exists exclusive_tax_amount_paise bigint not null default 0,
        add column if not exists tax_amount_paise bigint not null default 0,
        add column if not exists total_amount_paise bigint not null default 0,
        add column if not exists rounding_adjustment_paise bigint not null default 0;
      create index if not exists idx_booking_addon_charge_lines_booking
        on zigo.booking_addon_charge_lines(service_request_id, created_at);
      create table if not exists zigo.booking_tax_lines (
        id uuid primary key default gen_random_uuid(),
        service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
        addon_charge_line_id uuid references zigo.booking_addon_charge_lines(id),
        tax_master_rule_id uuid references zigo.tax_master_rules(id),
        tax_category text not null,
        tax_label text not null,
        applicable_on text not null,
        tax_applicability text not null,
        tax_type text not null,
        tax_value numeric(12,2) not null default 0,
        taxable_amount_paise bigint not null default 0,
        tax_amount_paise bigint not null default 0,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_booking_tax_lines_booking
        on zigo.booking_tax_lines(service_request_id, created_at);
    `).then(() => undefined).catch((error) => {
            schemaReady = null;
            throw error;
        });
    }
    await schemaReady;
}
function normalizeSlabs(value, distance = false) {
    if (!Array.isArray(value))
        return [];
    return value.map((slab) => {
        const row = slab && typeof slab === "object" ? slab : {};
        return distance
            ? {
                maxDistanceKm: Math.max(0, Number(row.maxDistanceKm || 0)),
                discountType: row.discountType === "flat" ? "flat" : "percent",
                discountValue: Math.max(0, Number(row.discountValue || 0))
            }
            : {
                maxAmount: Math.max(0, Number(row.maxAmount || 0)),
                discountType: row.discountType === "flat" ? "flat" : "percent",
                discountValue: Math.max(0, Number(row.discountValue || 0))
            };
    }).filter((slab) => Number(distance ? slab.maxDistanceKm : slab.maxAmount) > 0);
}
function normalizeInput(input) {
    const addonType = ADDON_CHARGE_TYPES.includes(input.addonType) ? input.addonType : "service";
    const applicableOn = ADDON_APPLICABILITY.includes(input.applicableOn) ? input.applicableOn : "all_customer";
    const costType = input.costType === "percent" ? "percent" : "flat";
    const percentageBase = ADDON_PERCENT_BASES.includes(input.percentageBase) ? input.percentageBase : "selling_price";
    const scopeType = ADDON_SCOPE_TYPES.includes(input.scopeType) ? input.scopeType : "all";
    const scoped = (types) => types.includes(scopeType);
    return {
        addonType,
        scope: String(input.scope || scopeType).trim() || scopeType,
        scopeType,
        stateId: scoped(["state", "city", "zone", "cluster", "micro_market", "nano_market"]) ? input.stateId || null : null,
        cityId: scoped(["city", "zone", "cluster", "micro_market", "nano_market"]) ? input.cityId || null : null,
        zoneId: scoped(["zone", "cluster", "micro_market", "nano_market"]) ? input.zoneId || null : null,
        clusterId: scoped(["cluster", "micro_market", "nano_market"]) ? input.clusterId || null : null,
        microMarketId: scoped(["micro_market", "nano_market"]) ? input.microMarketId || null : null,
        nanoMarketId: scopeType === "nano_market" ? input.nanoMarketId || null : null,
        title: String(input.title || "").trim(),
        description: String(input.description || "").trim() || null,
        label: String(input.label || input.title || "").trim(),
        applicableOn,
        costType,
        costValue: Math.max(0, Number(input.costValue || 0)),
        percentageBase,
        customerPrice: input.customerPrice == null ? null : Math.max(0, Number(input.customerPrice)),
        discountSlabs: normalizeSlabs(input.discountSlabs),
        deliveryDistanceSlabs: normalizeSlabs(input.deliveryDistanceSlabs, true),
        isActive: input.isActive !== false
    };
}
export async function listAddOnChargeMasters() {
    await ensureAddOnChargeSchema();
    const result = await pool.query(`
    select zigo.addon_charge_masters.id,
      zigo.addon_charge_masters.addon_type as "addonType", zigo.addon_charge_masters.scope,
      zigo.addon_charge_masters.scope_type as "scopeType",
      zigo.addon_charge_masters.state_id as "stateId", zigo.addon_charge_masters.city_id as "cityId",
      zigo.addon_charge_masters.zone_id as "zoneId", zigo.addon_charge_masters.cluster_id as "clusterId",
      zigo.addon_charge_masters.micro_market_id as "microMarketId", zigo.addon_charge_masters.nano_market_id as "nanoMarketId",
      case zigo.addon_charge_masters.scope_type
        when 'state' then coalesce(state.name, 'State')
        when 'city' then coalesce(city.name, 'City')
        when 'zone' then coalesce(zone.name, 'Zone')
        when 'cluster' then coalesce(cluster.name, 'Cluster')
        when 'micro_market' then coalesce(micro.name, 'Micro Market')
        when 'nano_market' then coalesce(nano.name, 'Nano Market')
        else 'All locations'
      end as "scopeLabel",
      zigo.addon_charge_masters.title, zigo.addon_charge_masters.description, zigo.addon_charge_masters.label,
      zigo.addon_charge_masters.applicable_on as "applicableOn", zigo.addon_charge_masters.cost_type as "costType", zigo.addon_charge_masters.cost_value as "costValue",
      zigo.addon_charge_masters.percentage_base as "percentageBase", zigo.addon_charge_masters.customer_price as "customerPrice",
      zigo.addon_charge_masters.discount_slabs as "discountSlabs", zigo.addon_charge_masters.delivery_distance_slabs as "deliveryDistanceSlabs",
      zigo.addon_charge_masters.metadata, zigo.addon_charge_masters.is_active as "isActive", zigo.addon_charge_masters.created_at as "createdAt", zigo.addon_charge_masters.updated_at as "updatedAt"
    from zigo.addon_charge_masters
    left join zigo.states state on state.id = zigo.addon_charge_masters.state_id
    left join zigo.cities city on city.id = zigo.addon_charge_masters.city_id
    left join zigo.zones zone on zone.id = zigo.addon_charge_masters.zone_id
    left join zigo.clusters cluster on cluster.id = zigo.addon_charge_masters.cluster_id
    left join zigo.micro_markets micro on micro.id = zigo.addon_charge_masters.micro_market_id
    left join zigo.nano_markets nano on nano.id = zigo.addon_charge_masters.nano_market_id
    where coalesce(zigo.addon_charge_masters.is_deleted, false) = false
    order by zigo.addon_charge_masters.addon_type, zigo.addon_charge_masters.title,
             zigo.addon_charge_masters.updated_at desc, zigo.addon_charge_masters.created_at desc
  `);
    return result.rows;
}
export async function listActiveAddOnChargeMasters() {
    return (await listAddOnChargeMasters()).filter((row) => row.isActive !== false);
}
export async function createAddOnChargeMaster(input) {
    await ensureAddOnChargeSchema();
    const normalized = normalizeInput(input);
    const result = await pool.query(`
    insert into zigo.addon_charge_masters
      (addon_type, scope, scope_type, state_id, city_id, zone_id, cluster_id, micro_market_id, nano_market_id,
       title, description, label, applicable_on, cost_type, cost_value,
       percentage_base, customer_price, discount_slabs, delivery_distance_slabs, is_active, created_by, updated_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$21,$21)
    returning id
  `, [normalized.addonType, normalized.scope, normalized.scopeType, normalized.stateId, normalized.cityId,
        normalized.zoneId, normalized.clusterId, normalized.microMarketId, normalized.nanoMarketId,
        normalized.title, normalized.description, normalized.label, normalized.applicableOn, normalized.costType,
        normalized.costValue, normalized.percentageBase, normalized.customerPrice, JSON.stringify(normalized.discountSlabs),
        JSON.stringify(normalized.deliveryDistanceSlabs), normalized.isActive, input.userId]);
    return result.rows[0];
}
export async function updateAddOnChargeMaster(id, input) {
    await ensureAddOnChargeSchema();
    const normalized = normalizeInput(input);
    const result = await pool.query(`
    update zigo.addon_charge_masters
    set addon_type=$2, scope=$3, scope_type=$4, state_id=$5, city_id=$6, zone_id=$7, cluster_id=$8,
        micro_market_id=$9, nano_market_id=$10, title=$11, description=$12, label=$13, applicable_on=$14,
        cost_type=$15, cost_value=$16, percentage_base=$17, customer_price=$18,
        discount_slabs=$19::jsonb, delivery_distance_slabs=$20::jsonb, is_active=$21,
        updated_by=$22, updated_at=now()
    where id=$1::uuid and coalesce(is_deleted, false)=false
    returning id
  `, [id, normalized.addonType, normalized.scope, normalized.scopeType, normalized.stateId, normalized.cityId,
        normalized.zoneId, normalized.clusterId, normalized.microMarketId, normalized.nanoMarketId, normalized.title,
        normalized.description, normalized.label, normalized.applicableOn, normalized.costType, normalized.costValue,
        normalized.percentageBase, normalized.customerPrice, JSON.stringify(normalized.discountSlabs),
        JSON.stringify(normalized.deliveryDistanceSlabs), normalized.isActive, input.userId]);
    return result.rows[0] ?? null;
}
export async function deleteAddOnChargeMaster(id, userId) {
    await ensureAddOnChargeSchema();
    const result = await pool.query(`
    update zigo.addon_charge_masters
    set is_deleted=true, is_active=false, deleted_by=$2, deleted_at=now(), updated_by=$2, updated_at=now()
    where id=$1::uuid and coalesce(is_deleted, false)=false
    returning id
  `, [id, userId]);
    return result.rows[0] ?? null;
}
