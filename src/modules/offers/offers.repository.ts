import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

type Queryable = Pick<typeof pool, "query">;

export type OfferType = "PACKAGE" | "DISCOUNT" | "BUY_X_GET_Y" | "FREE_SERVICE" | "CREDIT" | "FIXED_PRICE";
export type OfferStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";

export type OfferContentInput = {
  contentType: "service" | "do" | "dont" | "term";
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  iconUrl?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export type OfferInput = {
  internalName: string;
  offerType: OfferType;
  status?: OfferStatus;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  note?: string | null;
  iconUrl?: string | null;
  imageUrl?: string | null;
  priority?: number;
  customOfferExclusive?: boolean;
  fallbackToGeneralOffer?: boolean;
  stackingAllowed?: boolean;
  audienceType?: "all" | "selected_users";
  userSegment?: "new" | "old" | "all";
  validityMode?: "fixed_dates" | "days_from_purchase" | "days_from_issue" | "days_from_first_use" | "no_expiry";
  activeFrom?: string | null;
  activeUntil?: string | null;
  validDays?: number | null;
  redeemLimitPerUser?: number;
  redeemLimitTotal?: number | null;
  redeemLimitDaily?: number | null;
  redeemLimitCluster?: number | null;
  cooldownMinutes?: number;
  packagePurchaseLimit?: number | null;
  autoApply?: boolean;
  publicCode?: string | null;
  referralEnabled?: boolean;
  referralScope?: "none" | "all_assistants" | "selected_assistants";
  commonReferralCode?: string | null;
  discountType?: "none" | "percent" | "flat";
  discountValue?: number;
  discountCapPaise?: number | null;
  fixedPricePaise?: number | null;
  buyQuantity?: number | null;
  freeQuantity?: number | null;
  creditAmountPaise?: number | null;
  packagePricePaise?: number | null;
  isEnabled?: boolean;
  isActive?: boolean;
  scopes?: Array<{ scopeType: "all" | "state" | "city" | "zone" | "cluster"; stateId?: string | null; cityId?: string | null; zoneId?: string | null; clusterId?: string | null }>;
  includedUserIds?: string[];
  excludedUserIds?: string[];
  serviceMasterIds?: string[];
  legacyServiceIds?: string[];
  categoryIds?: string[];
  bookingTypes?: Array<"instant" | "schedule" | "both">;
  durationIds?: string[];
  paymentModeIds?: string[];
  paymentModeCodes?: string[];
  referralCodes?: Array<{ assistantId?: string | null; code: string; rewardType?: string; rewardValue?: number; maxUses?: number | null; isActive?: boolean }>;
  contentItems?: OfferContentInput[];
  metadata?: Record<string, unknown>;
  userId: string;
};

export type OfferFilters = {
  search?: string;
  status?: OfferStatus | "all";
  offerType?: OfferType | "all";
  page?: number;
  pageSize?: number;
};

let offerSchemaReady: Promise<void> | null = null;

export function ensureOfferMasterSchema(client: Queryable = pool) {
  if (client === pool && offerSchemaReady) return offerSchemaReady;
  const promise = client.query(`
    alter table zigo.category_price_rules
      add column if not exists is_duration_for_offers boolean not null default false,
      add column if not exists is_offer_eligible boolean not null default true;
    create table if not exists zigo.offers (
      id uuid primary key default gen_random_uuid(),
      internal_name text not null,
      offer_type text not null,
      status text not null default 'DRAFT',
      title text not null,
      subtitle text,
      description text,
      note text,
      icon_url text,
      image_url text,
      priority integer not null default 0,
      custom_offer_exclusive boolean not null default true,
      fallback_to_general_offer boolean not null default false,
      stacking_allowed boolean not null default false,
      audience_type text not null default 'all',
      user_segment text not null default 'all',
      validity_mode text not null default 'fixed_dates',
      active_from timestamptz,
      active_until timestamptz,
      valid_days integer,
      redeem_limit_per_user integer not null default 1,
      redeem_limit_total integer,
      redeem_limit_daily integer,
      redeem_limit_cluster integer,
      cooldown_minutes integer not null default 0,
      package_purchase_limit integer,
      auto_apply boolean not null default false,
      public_code text,
      referral_enabled boolean not null default false,
      referral_scope text not null default 'none',
      common_referral_code text,
      discount_type text not null default 'none',
      discount_value numeric(12,2) not null default 0,
      discount_cap_paise integer,
      fixed_price_paise integer,
      buy_quantity integer,
      free_quantity integer,
      credit_amount_paise integer,
      package_price_paise integer,
      metadata jsonb not null default '{}'::jsonb,
      current_version_id uuid,
      is_enabled boolean not null default true,
      is_active boolean not null default true,
      is_deleted boolean not null default false,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz
    );
    create table if not exists zigo.offer_versions (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references zigo.offers(id),
      version_no integer not null,
      snapshot jsonb not null,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      unique (offer_id, version_no)
    );
    create table if not exists zigo.offer_scopes (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references zigo.offers(id) on delete cascade,
      scope_type text not null default 'all',
      state_id uuid references zigo.states(id),
      city_id uuid references zigo.cities(id),
      zone_id uuid references zigo.zones(id),
      cluster_id uuid references zigo.clusters(id),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create table if not exists zigo.offer_included_users (offer_id uuid not null references zigo.offers(id) on delete cascade, user_id uuid not null references zigo.users(id), created_at timestamptz not null default now(), primary key (offer_id, user_id));
    create table if not exists zigo.offer_excluded_users (offer_id uuid not null references zigo.offers(id) on delete cascade, user_id uuid not null references zigo.users(id), created_at timestamptz not null default now(), primary key (offer_id, user_id));
    create table if not exists zigo.offer_services (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references zigo.offers(id) on delete cascade,
      service_master_id uuid references zigo.category_service_masters(id),
      service_id uuid references zigo.services(id),
      created_at timestamptz not null default now(),
      constraint offer_services_one_source_check check (service_master_id is not null or service_id is not null)
    );
    create table if not exists zigo.offer_categories (offer_id uuid not null references zigo.offers(id) on delete cascade, category_id uuid not null references zigo.categories(id), created_at timestamptz not null default now(), primary key (offer_id, category_id));
    create table if not exists zigo.offer_booking_types (offer_id uuid not null references zigo.offers(id) on delete cascade, booking_type text not null, created_at timestamptz not null default now(), primary key (offer_id, booking_type));
    create table if not exists zigo.offer_durations (offer_id uuid not null references zigo.offers(id) on delete cascade, category_price_rule_id uuid not null references zigo.category_price_rules(id), created_at timestamptz not null default now(), primary key (offer_id, category_price_rule_id));
    create table if not exists zigo.offer_payment_modes (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references zigo.offers(id) on delete cascade,
      payment_mode_id uuid references zigo.payment_mode_masters(id),
      payment_mode_code text,
      created_at timestamptz not null default now()
    );
    create table if not exists zigo.offer_referral_codes (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id) on delete cascade, assistant_id uuid references zigo.assistants(id), code text not null unique, reward_type text not null default 'none', reward_value numeric(12,2) not null default 0, max_uses integer, used_count integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now());
    create table if not exists zigo.offer_content_items (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id) on delete cascade, content_type text not null, title text, subtitle text, body text, icon_url text, image_url text, sort_order integer not null default 0, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
    create table if not exists zigo.offer_purchase_orders (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id), offer_version_id uuid references zigo.offer_versions(id), customer_id uuid not null references zigo.users(id), razorpay_order_id text, razorpay_payment_id text, amount_paise integer not null default 0, currency text not null default 'INR', status text not null default 'CREATED', idempotency_key text unique, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists zigo.user_offer_entitlements (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id), offer_version_id uuid references zigo.offer_versions(id), purchase_order_id uuid references zigo.offer_purchase_orders(id), customer_id uuid not null references zigo.users(id), total_units integer not null default 1, remaining_units integer not null default 1, status text not null default 'ACTIVE', valid_from timestamptz not null default now(), valid_until timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists zigo.offer_redemption_ledger (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id), offer_version_id uuid references zigo.offer_versions(id), entitlement_id uuid references zigo.user_offer_entitlements(id), booking_id uuid references zigo.bookings(id), customer_id uuid not null references zigo.users(id), status text not null default 'RESERVED', benefit_type text not null default 'none', benefit_amount_paise integer not null default 0, idempotency_key text unique, reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists zigo.offer_referral_attributions (id uuid primary key default gen_random_uuid(), offer_id uuid not null references zigo.offers(id), referral_code_id uuid references zigo.offer_referral_codes(id), assistant_id uuid references zigo.assistants(id), customer_id uuid not null references zigo.users(id), booking_id uuid references zigo.bookings(id), purchase_order_id uuid references zigo.offer_purchase_orders(id), status text not null default 'PENDING', reward_amount_paise integer not null default 0, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists zigo.offer_audit_logs (id uuid primary key default gen_random_uuid(), offer_id uuid references zigo.offers(id), actor_user_id uuid references zigo.users(id), action text not null, before_snapshot jsonb, after_snapshot jsonb, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
    create unique index if not exists idx_offers_public_code_unique on zigo.offers(lower(public_code)) where public_code is not null and public_code <> '' and is_deleted = false;
    create index if not exists idx_offers_status_active on zigo.offers(status, is_active, is_enabled, is_deleted);
    create unique index if not exists idx_offer_services_master_unique on zigo.offer_services(offer_id, service_master_id) where service_master_id is not null;
    create unique index if not exists idx_offer_services_legacy_unique on zigo.offer_services(offer_id, service_id) where service_id is not null;
    create unique index if not exists idx_offer_payment_modes_id_unique on zigo.offer_payment_modes(offer_id, payment_mode_id) where payment_mode_id is not null;
    create unique index if not exists idx_offer_payment_modes_code_unique on zigo.offer_payment_modes(offer_id, lower(payment_mode_code)) where payment_mode_code is not null and payment_mode_code <> '';
  `).then(() => undefined).catch((error) => {
    if (client === pool) offerSchemaReady = null;
    throw error;
  });
  if (client === pool) offerSchemaReady = promise;
  return promise;
}

function normalizePage(page = 1, pageSize = 20) {
  return { page: Math.max(1, Math.trunc(page)), pageSize: Math.max(5, Math.min(200, Math.trunc(pageSize))) };
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function nullableText(value: unknown) {
  const text = cleanText(value);
  return text ? text : null;
}

function intOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? number : null;
}

function normalizeOfferInput(input: OfferInput) {
  return {
    ...input,
    internalName: cleanText(input.internalName, input.title),
    title: cleanText(input.title),
    subtitle: nullableText(input.subtitle),
    description: nullableText(input.description),
    note: nullableText(input.note),
    iconUrl: nullableText(input.iconUrl),
    imageUrl: nullableText(input.imageUrl),
    publicCode: nullableText(input.publicCode)?.toUpperCase() ?? null,
    commonReferralCode: nullableText(input.commonReferralCode)?.toUpperCase() ?? null,
    status: input.status ?? "DRAFT",
    priority: Math.trunc(Number(input.priority ?? 0)),
    redeemLimitPerUser: Math.max(1, Math.trunc(Number(input.redeemLimitPerUser ?? 1))),
    cooldownMinutes: Math.max(0, Math.trunc(Number(input.cooldownMinutes ?? 0))),
    packagePricePaise: intOrNull(input.packagePricePaise),
    fixedPricePaise: intOrNull(input.fixedPricePaise),
    discountCapPaise: intOrNull(input.discountCapPaise),
    creditAmountPaise: intOrNull(input.creditAmountPaise),
    validDays: intOrNull(input.validDays),
    redeemLimitTotal: intOrNull(input.redeemLimitTotal),
    redeemLimitDaily: intOrNull(input.redeemLimitDaily),
    redeemLimitCluster: intOrNull(input.redeemLimitCluster),
    packagePurchaseLimit: intOrNull(input.packagePurchaseLimit),
    buyQuantity: intOrNull(input.buyQuantity),
    freeQuantity: intOrNull(input.freeQuantity),
    scopes: input.scopes?.length ? input.scopes : [{ scopeType: "all" as const }],
    metadata: input.metadata ?? {}
  };
}

export function validateOfferInput(input: OfferInput) {
  const offer = normalizeOfferInput(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!offer.title) errors.push("Offer title is required.");
  if (!offer.internalName) errors.push("Internal name is required.");
  if (offer.offerType === "DISCOUNT" && (offer.discountType === "none" || Number(offer.discountValue ?? 0) <= 0)) errors.push("Discount offers require a discount type and value.");
  if (offer.offerType === "PACKAGE" && !offer.packagePricePaise) errors.push("Package offers require a package purchase price.");
  if (offer.offerType === "FIXED_PRICE" && !offer.fixedPricePaise) errors.push("Fixed price offers require a fixed price.");
  if (offer.offerType === "BUY_X_GET_Y" && (!offer.buyQuantity || !offer.freeQuantity)) errors.push("Buy/Get offers require buy and free quantities.");
  if (offer.validityMode === "fixed_dates" && !offer.activeUntil) warnings.push("Fixed-date offers should usually have an end date.");
  if (offer.audienceType === "selected_users" && !offer.includedUserIds?.length) errors.push("Selected-user offers require at least one included user.");
  if (offer.referralEnabled && offer.referralScope === "selected_assistants" && !offer.referralCodes?.length) warnings.push("Selected-assistant referral is enabled but no assistant code is configured.");
  return { valid: errors.length === 0, errors, warnings };
}

const offerSelect = `
  select o.id,
    o.internal_name as "internalName",
    o.offer_type as "offerType",
    o.status,
    o.title,
    o.subtitle,
    o.description,
    o.note,
    o.icon_url as "iconUrl",
    o.image_url as "imageUrl",
    o.priority,
    o.custom_offer_exclusive as "customOfferExclusive",
    o.fallback_to_general_offer as "fallbackToGeneralOffer",
    o.stacking_allowed as "stackingAllowed",
    o.audience_type as "audienceType",
    o.user_segment as "userSegment",
    o.validity_mode as "validityMode",
    o.active_from as "activeFrom",
    o.active_until as "activeUntil",
    o.valid_days as "validDays",
    o.redeem_limit_per_user as "redeemLimitPerUser",
    o.redeem_limit_total as "redeemLimitTotal",
    o.redeem_limit_daily as "redeemLimitDaily",
    o.redeem_limit_cluster as "redeemLimitCluster",
    o.cooldown_minutes as "cooldownMinutes",
    o.package_purchase_limit as "packagePurchaseLimit",
    o.auto_apply as "autoApply",
    o.public_code as "publicCode",
    o.referral_enabled as "referralEnabled",
    o.referral_scope as "referralScope",
    o.common_referral_code as "commonReferralCode",
    o.discount_type as "discountType",
    o.discount_value as "discountValue",
    o.discount_cap_paise as "discountCapPaise",
    o.fixed_price_paise as "fixedPricePaise",
    o.buy_quantity as "buyQuantity",
    o.free_quantity as "freeQuantity",
    o.credit_amount_paise as "creditAmountPaise",
    o.package_price_paise as "packagePricePaise",
    o.current_version_id as "currentVersionId",
    o.metadata,
    o.is_enabled as "isEnabled",
    o.is_active as "isActive",
    o.created_at as "createdAt",
    o.updated_at as "updatedAt",
    coalesce(redemptions.total, 0)::int as "redemptionCount",
    coalesce(redemptions.consumed, 0)::int as "consumedCount"
  from zigo.offers o
  left join lateral (
    select count(*) as total, count(*) filter (where status = 'CONSUMED') as consumed
    from zigo.offer_redemption_ledger r
    where r.offer_id = o.id
  ) redemptions on true
`;

async function getOfferCore(id: string, client: Queryable = pool) {
  const result = await client.query(`${offerSelect} where o.id = $1::uuid and coalesce(o.is_deleted, false) = false`, [id]);
  return result.rows[0] ?? null;
}

async function relatedOfferData(id: string, client: Queryable = pool) {
  const [scopes, included, excluded, services, categories, bookingTypes, durations, paymentModes, referralCodes, contentItems] = await Promise.all([
    client.query(`select scope_type as "scopeType", state_id as "stateId", city_id as "cityId", zone_id as "zoneId", cluster_id as "clusterId" from zigo.offer_scopes where offer_id = $1::uuid order by created_at`, [id]),
    client.query(`select user_id as "userId" from zigo.offer_included_users where offer_id = $1::uuid`, [id]),
    client.query(`select user_id as "userId" from zigo.offer_excluded_users where offer_id = $1::uuid`, [id]),
    client.query(`select service_master_id as "serviceMasterId", service_id as "legacyServiceId" from zigo.offer_services where offer_id = $1::uuid`, [id]),
    client.query(`select category_id as "categoryId" from zigo.offer_categories where offer_id = $1::uuid`, [id]),
    client.query(`select booking_type as "bookingType" from zigo.offer_booking_types where offer_id = $1::uuid`, [id]),
    client.query(`select category_price_rule_id as "categoryPriceRuleId" from zigo.offer_durations where offer_id = $1::uuid`, [id]),
    client.query(`select payment_mode_id as "paymentModeId", payment_mode_code as "paymentModeCode" from zigo.offer_payment_modes where offer_id = $1::uuid`, [id]),
    client.query(`select id, assistant_id as "assistantId", code, reward_type as "rewardType", reward_value as "rewardValue", max_uses as "maxUses", used_count as "usedCount", is_active as "isActive" from zigo.offer_referral_codes where offer_id = $1::uuid order by created_at`, [id]),
    client.query(`select id, content_type as "contentType", title, subtitle, body, icon_url as "iconUrl", image_url as "imageUrl", sort_order as "sortOrder", metadata from zigo.offer_content_items where offer_id = $1::uuid order by content_type, sort_order, created_at`, [id])
  ]);
  return {
    scopes: scopes.rows,
    includedUserIds: included.rows.map((row) => row.userId),
    excludedUserIds: excluded.rows.map((row) => row.userId),
    serviceMasterIds: services.rows.map((row) => row.serviceMasterId).filter(Boolean),
    legacyServiceIds: services.rows.map((row) => row.legacyServiceId).filter(Boolean),
    categoryIds: categories.rows.map((row) => row.categoryId),
    bookingTypes: bookingTypes.rows.map((row) => row.bookingType),
    durationIds: durations.rows.map((row) => row.categoryPriceRuleId),
    paymentModeIds: paymentModes.rows.map((row) => row.paymentModeId).filter(Boolean),
    paymentModeCodes: paymentModes.rows.map((row) => row.paymentModeCode).filter(Boolean),
    referralCodes: referralCodes.rows,
    contentItems: contentItems.rows
  };
}

export async function listOffers(filters: OfferFilters = {}) {
  await ensureOfferMasterSchema();
  const pageInfo = normalizePage(filters.page, filters.pageSize);
  const where = ["coalesce(o.is_deleted, false) = false"];
  const params: unknown[] = [];
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(`(o.title ilike $${params.length} or o.internal_name ilike $${params.length} or coalesce(o.public_code, '') ilike $${params.length})`);
  }
  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`o.status = $${params.length}`);
  }
  if (filters.offerType && filters.offerType !== "all") {
    params.push(filters.offerType);
    where.push(`o.offer_type = $${params.length}`);
  }
  params.push(pageInfo.pageSize, (pageInfo.page - 1) * pageInfo.pageSize);
  const result = await pool.query(`${offerSelect} where ${where.join(" and ")} order by o.priority desc, o.updated_at desc limit $${params.length - 1} offset $${params.length}`, params);
  const countParams = params.slice(0, -2);
  const count = await pool.query(`select count(*)::int as total from zigo.offers o where ${where.join(" and ")}`, countParams);
  return { data: result.rows, pagination: { ...pageInfo, total: count.rows[0]?.total ?? 0 } };
}

export async function getOffer(id: string) {
  await ensureOfferMasterSchema();
  const offer = await getOfferCore(id);
  if (!offer) throw new HttpError(404, "Offer not found.");
  return { ...offer, ...(await relatedOfferData(id)) };
}

async function nextVersionNo(offerId: string, client: PoolClient) {
  const result = await client.query(`select coalesce(max(version_no), 0) + 1 as "versionNo" from zigo.offer_versions where offer_id = $1::uuid`, [offerId]);
  return Number(result.rows[0]?.versionNo ?? 1);
}

async function writeRelatedOfferData(offerId: string, input: ReturnType<typeof normalizeOfferInput>, client: PoolClient) {
  await client.query(`delete from zigo.offer_scopes where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_included_users where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_excluded_users where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_services where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_categories where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_booking_types where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_durations where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_payment_modes where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_referral_codes where offer_id = $1::uuid`, [offerId]);
  await client.query(`delete from zigo.offer_content_items where offer_id = $1::uuid`, [offerId]);

  for (const scope of input.scopes) {
    await client.query(
      `insert into zigo.offer_scopes (offer_id, scope_type, state_id, city_id, zone_id, cluster_id) values ($1, $2, $3, $4, $5, $6)`,
      [offerId, scope.scopeType, scope.stateId || null, scope.cityId || null, scope.zoneId || null, scope.clusterId || null]
    );
  }
  for (const userId of input.includedUserIds ?? []) await client.query(`insert into zigo.offer_included_users (offer_id, user_id) values ($1, $2) on conflict do nothing`, [offerId, userId]);
  for (const userId of input.excludedUserIds ?? []) await client.query(`insert into zigo.offer_excluded_users (offer_id, user_id) values ($1, $2) on conflict do nothing`, [offerId, userId]);
  for (const serviceMasterId of input.serviceMasterIds ?? []) await client.query(`insert into zigo.offer_services (offer_id, service_master_id) values ($1, $2)`, [offerId, serviceMasterId]);
  for (const serviceId of input.legacyServiceIds ?? []) await client.query(`insert into zigo.offer_services (offer_id, service_id) values ($1, $2)`, [offerId, serviceId]);
  for (const categoryId of input.categoryIds ?? []) await client.query(`insert into zigo.offer_categories (offer_id, category_id) values ($1, $2) on conflict do nothing`, [offerId, categoryId]);
  for (const bookingType of input.bookingTypes ?? []) await client.query(`insert into zigo.offer_booking_types (offer_id, booking_type) values ($1, $2) on conflict do nothing`, [offerId, bookingType]);
  for (const durationId of input.durationIds ?? []) await client.query(`insert into zigo.offer_durations (offer_id, category_price_rule_id) values ($1, $2) on conflict do nothing`, [offerId, durationId]);
  for (const paymentModeId of input.paymentModeIds ?? []) await client.query(`insert into zigo.offer_payment_modes (offer_id, payment_mode_id) values ($1, $2)`, [offerId, paymentModeId]);
  for (const paymentModeCode of input.paymentModeCodes ?? []) await client.query(`insert into zigo.offer_payment_modes (offer_id, payment_mode_code) values ($1, $2)`, [offerId, paymentModeCode]);
  for (const referral of input.referralCodes ?? []) {
    if (!referral.code?.trim()) continue;
    await client.query(
      `insert into zigo.offer_referral_codes (offer_id, assistant_id, code, reward_type, reward_value, max_uses, is_active) values ($1, $2, $3, $4, $5, $6, $7)`,
      [offerId, referral.assistantId || null, referral.code.trim().toUpperCase(), referral.rewardType || "none", Number(referral.rewardValue ?? 0), intOrNull(referral.maxUses), referral.isActive ?? true]
    );
  }
  for (const item of input.contentItems ?? []) {
    await client.query(
      `insert into zigo.offer_content_items (offer_id, content_type, title, subtitle, body, icon_url, image_url, sort_order, metadata) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [offerId, item.contentType, nullableText(item.title), nullableText(item.subtitle), nullableText(item.body), nullableText(item.iconUrl), nullableText(item.imageUrl), Math.trunc(Number(item.sortOrder ?? 0)), JSON.stringify(item.metadata ?? {})]
    );
  }
}

async function snapshotOffer(offerId: string, actorUserId: string, client: PoolClient) {
  const offer = await getOfferCore(offerId, client);
  const related = await relatedOfferData(offerId, client);
  const versionNo = await nextVersionNo(offerId, client);
  const version = await client.query(
    `insert into zigo.offer_versions (offer_id, version_no, snapshot, created_by) values ($1, $2, $3::jsonb, $4) returning id`,
    [offerId, versionNo, JSON.stringify({ ...offer, ...related }), actorUserId]
  );
  await client.query(`update zigo.offers set current_version_id = $2 where id = $1`, [offerId, version.rows[0].id]);
}

async function auditOffer(offerId: string, actorUserId: string, action: string, beforeSnapshot: unknown, afterSnapshot: unknown, client: PoolClient) {
  await client.query(
    `insert into zigo.offer_audit_logs (offer_id, actor_user_id, action, before_snapshot, after_snapshot) values ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [offerId, actorUserId, action, beforeSnapshot ? JSON.stringify(beforeSnapshot) : null, afterSnapshot ? JSON.stringify(afterSnapshot) : null]
  );
}

export async function createOffer(input: OfferInput) {
  await ensureOfferMasterSchema();
  const validation = validateOfferInput(input);
  if (!validation.valid) throw new HttpError(400, validation.errors.join(" "));
  const offer = normalizeOfferInput(input);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `
        insert into zigo.offers (
          internal_name, offer_type, status, title, subtitle, description, note, icon_url, image_url, priority,
          custom_offer_exclusive, fallback_to_general_offer, stacking_allowed, audience_type, user_segment,
          validity_mode, active_from, active_until, valid_days, redeem_limit_per_user, redeem_limit_total,
          redeem_limit_daily, redeem_limit_cluster, cooldown_minutes, package_purchase_limit, auto_apply,
          public_code, referral_enabled, referral_scope, common_referral_code, discount_type, discount_value,
          discount_cap_paise, fixed_price_paise, buy_quantity, free_quantity, credit_amount_paise,
          package_price_paise, metadata, is_enabled, is_active, created_by, updated_by
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39::jsonb,$40,$41,$42,$42)
        returning id
      `,
      [
        offer.internalName, offer.offerType, offer.status, offer.title, offer.subtitle, offer.description, offer.note, offer.iconUrl, offer.imageUrl, offer.priority,
        offer.customOfferExclusive ?? true, offer.fallbackToGeneralOffer ?? false, offer.stackingAllowed ?? false, offer.audienceType ?? "all", offer.userSegment ?? "all",
        offer.validityMode ?? "fixed_dates", offer.activeFrom || null, offer.activeUntil || null, offer.validDays, offer.redeemLimitPerUser, offer.redeemLimitTotal,
        offer.redeemLimitDaily, offer.redeemLimitCluster, offer.cooldownMinutes, offer.packagePurchaseLimit, offer.autoApply ?? false, offer.publicCode,
        offer.referralEnabled ?? false, offer.referralScope ?? "none", offer.commonReferralCode, offer.discountType ?? "none", Number(offer.discountValue ?? 0),
        offer.discountCapPaise, offer.fixedPricePaise, offer.buyQuantity, offer.freeQuantity, offer.creditAmountPaise, offer.packagePricePaise,
        JSON.stringify(offer.metadata), offer.isEnabled ?? true, offer.isActive ?? true, offer.userId
      ]
    );
    const id = result.rows[0].id;
    await writeRelatedOfferData(id, offer, client);
    await snapshotOffer(id, offer.userId, client);
    await auditOffer(id, offer.userId, "create", null, await getOfferCore(id, client), client);
    await client.query("commit");
    return getOffer(id);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOffer(id: string, input: OfferInput) {
  await ensureOfferMasterSchema();
  const before = await getOffer(id);
  const validation = validateOfferInput(input);
  if (!validation.valid) throw new HttpError(400, validation.errors.join(" "));
  const offer = normalizeOfferInput(input);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `
        update zigo.offers set
          internal_name = $2, offer_type = $3, status = $4, title = $5, subtitle = $6, description = $7, note = $8,
          icon_url = $9, image_url = $10, priority = $11, custom_offer_exclusive = $12, fallback_to_general_offer = $13,
          stacking_allowed = $14, audience_type = $15, user_segment = $16, validity_mode = $17, active_from = $18,
          active_until = $19, valid_days = $20, redeem_limit_per_user = $21, redeem_limit_total = $22,
          redeem_limit_daily = $23, redeem_limit_cluster = $24, cooldown_minutes = $25, package_purchase_limit = $26,
          auto_apply = $27, public_code = $28, referral_enabled = $29, referral_scope = $30, common_referral_code = $31,
          discount_type = $32, discount_value = $33, discount_cap_paise = $34, fixed_price_paise = $35,
          buy_quantity = $36, free_quantity = $37, credit_amount_paise = $38, package_price_paise = $39,
          metadata = $40::jsonb, is_enabled = $41, is_active = $42, updated_by = $43, updated_at = now()
        where id = $1::uuid and coalesce(is_deleted, false) = false
        returning id
      `,
      [
        id, offer.internalName, offer.offerType, offer.status, offer.title, offer.subtitle, offer.description, offer.note, offer.iconUrl, offer.imageUrl, offer.priority,
        offer.customOfferExclusive ?? true, offer.fallbackToGeneralOffer ?? false, offer.stackingAllowed ?? false, offer.audienceType ?? "all", offer.userSegment ?? "all",
        offer.validityMode ?? "fixed_dates", offer.activeFrom || null, offer.activeUntil || null, offer.validDays, offer.redeemLimitPerUser, offer.redeemLimitTotal,
        offer.redeemLimitDaily, offer.redeemLimitCluster, offer.cooldownMinutes, offer.packagePurchaseLimit, offer.autoApply ?? false, offer.publicCode,
        offer.referralEnabled ?? false, offer.referralScope ?? "none", offer.commonReferralCode, offer.discountType ?? "none", Number(offer.discountValue ?? 0),
        offer.discountCapPaise, offer.fixedPricePaise, offer.buyQuantity, offer.freeQuantity, offer.creditAmountPaise, offer.packagePricePaise,
        JSON.stringify(offer.metadata), offer.isEnabled ?? true, offer.isActive ?? true, offer.userId
      ]
    );
    if (!result.rows[0]) throw new HttpError(404, "Offer not found.");
    await writeRelatedOfferData(id, offer, client);
    await snapshotOffer(id, offer.userId, client);
    await auditOffer(id, offer.userId, "update", before, await getOfferCore(id, client), client);
    await client.query("commit");
    return getOffer(id);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setOfferStatus(id: string, status: OfferStatus, userId: string) {
  await ensureOfferMasterSchema();
  if (status === "ACTIVE") {
    const offer = await getOffer(id);
    const validation = validateOfferInput({ ...offer, userId });
    if (!validation.valid) throw new HttpError(400, validation.errors.join(" "));
  }
  const before = await getOffer(id);
  const result = await pool.query(
    `update zigo.offers set status = $2, updated_by = $3, updated_at = now() where id = $1::uuid and coalesce(is_deleted, false) = false returning id`,
    [id, status, userId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Offer not found.");
  await pool.query(
    `insert into zigo.offer_audit_logs (offer_id, actor_user_id, action, before_snapshot, after_snapshot) values ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [id, userId, status.toLowerCase(), JSON.stringify(before), JSON.stringify(await getOffer(id))]
  );
  return getOffer(id);
}

export async function validateOfferById(id: string) {
  const offer = await getOffer(id);
  return validateOfferInput({ ...offer, userId: offer.updatedBy || offer.createdBy || offer.id });
}

export async function listEligibleOffersForCustomer(customerUserId: string, filters: { paymentModeId?: string; paymentModeCode?: string; categoryId?: string; durationId?: string; bookingType?: string } = {}) {
  await ensureOfferMasterSchema();
  const params: unknown[] = [customerUserId];
  const result = await pool.query(
    `
      ${offerSelect}
      where coalesce(o.is_deleted, false) = false
        and o.is_enabled = true
        and o.is_active = true
        and o.status in ('ACTIVE','SCHEDULED')
        and (o.active_from is null or o.active_from <= now())
        and (o.active_until is null or o.active_until >= now())
        and not exists (select 1 from zigo.offer_excluded_users x where x.offer_id = o.id and x.user_id = $1::uuid)
        and (o.audience_type <> 'selected_users' or exists (select 1 from zigo.offer_included_users i where i.offer_id = o.id and i.user_id = $1::uuid))
        and ($2::uuid is null or not exists (select 1 from zigo.offer_categories c where c.offer_id = o.id) or exists (select 1 from zigo.offer_categories c where c.offer_id = o.id and c.category_id = $2::uuid))
        and ($3::uuid is null or not exists (select 1 from zigo.offer_durations d where d.offer_id = o.id) or exists (select 1 from zigo.offer_durations d where d.offer_id = o.id and d.category_price_rule_id = $3::uuid))
        and ($4::text is null or not exists (select 1 from zigo.offer_booking_types bt where bt.offer_id = o.id) or exists (select 1 from zigo.offer_booking_types bt where bt.offer_id = o.id and bt.booking_type in ($4, 'both')))
        and ($5::uuid is null or not exists (select 1 from zigo.offer_payment_modes pm where pm.offer_id = o.id) or exists (select 1 from zigo.offer_payment_modes pm where pm.offer_id = o.id and pm.payment_mode_id = $5::uuid))
        and ($6::text is null or not exists (select 1 from zigo.offer_payment_modes pm where pm.offer_id = o.id) or exists (select 1 from zigo.offer_payment_modes pm where pm.offer_id = o.id and pm.payment_mode_code = $6))
      order by
        case when exists (select 1 from zigo.user_offer_entitlements e where e.offer_id = o.id and e.customer_id = $1::uuid and e.status = 'ACTIVE' and e.remaining_units > 0) then 0 else 1 end,
        case when exists (select 1 from zigo.offer_included_users i where i.offer_id = o.id and i.user_id = $1::uuid) then 0 else 1 end,
        o.priority desc,
        o.updated_at desc
    `,
    [customerUserId, filters.categoryId || null, filters.durationId || null, filters.bookingType || null, filters.paymentModeId || null, filters.paymentModeCode || null]
  );
  return result.rows;
}

export async function validateCustomerOfferCode(customerUserId: string, code: string, filters: { paymentModeId?: string; categoryId?: string; durationId?: string; bookingType?: string } = {}) {
  const offers = await listEligibleOffersForCustomer(customerUserId, filters);
  const match = offers.find((offer) => String(offer.publicCode || "").toUpperCase() === code.trim().toUpperCase());
  if (!match) throw new HttpError(404, "Offer code is not eligible for this booking.");
  return match;
}

export async function validateCustomerReferralCode(customerUserId: string, code: string) {
  await ensureOfferMasterSchema();
  const result = await pool.query(
    `
      select rc.id as "referralCodeId", rc.code, rc.assistant_id as "assistantId", o.id as "offerId", o.title, o.offer_type as "offerType"
      from zigo.offer_referral_codes rc
      join zigo.offers o on o.id = rc.offer_id
      where upper(rc.code) = upper($1)
        and rc.is_active = true
        and o.referral_enabled = true
        and o.status in ('ACTIVE','SCHEDULED')
        and coalesce(o.is_deleted, false) = false
        and not exists (select 1 from zigo.offer_excluded_users x where x.offer_id = o.id and x.user_id = $2::uuid)
      limit 1
    `,
    [code.trim(), customerUserId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Referral code is not eligible.");
  return result.rows[0];
}

export async function listAssistantReferralOffers(assistantUserId: string) {
  await ensureOfferMasterSchema();
  const result = await pool.query(
    `
      select o.id as "offerId", o.title, o.subtitle, o.description, o.active_until as "activeUntil",
        rc.code, rc.reward_type as "rewardType", rc.reward_value as "rewardValue",
        rc.used_count as "successfulReferrals"
      from zigo.assistants a
      join zigo.offer_referral_codes rc on rc.assistant_id = a.id or rc.assistant_id is null
      join zigo.offers o on o.id = rc.offer_id
      where a.user_id = $1::uuid
        and rc.is_active = true
        and o.referral_enabled = true
        and o.status in ('ACTIVE','SCHEDULED')
        and coalesce(o.is_deleted, false) = false
      order by o.priority desc, o.updated_at desc
    `,
    [assistantUserId]
  );
  return result.rows;
}

export async function listOfferRedemptions(offerId: string) {
  await ensureOfferMasterSchema();
  const result = await pool.query(
    `
      select r.id, r.offer_id as "offerId", r.booking_id as "bookingId", r.customer_id as "customerId",
        u.display_name as "customerName", r.status, r.benefit_type as "benefitType",
        r.benefit_amount_paise as "benefitAmountPaise", r.reason, r.created_at as "createdAt", r.updated_at as "updatedAt"
      from zigo.offer_redemption_ledger r
      left join zigo.users u on u.id = r.customer_id
      where r.offer_id = $1::uuid
      order by r.created_at desc
    `,
    [offerId]
  );
  return result.rows;
}
