-- ZIGO Offer Master foundation
-- Additive-only migration. Keeps existing bookings/pricing data intact.

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
  deleted_at timestamptz,
  constraint offers_offer_type_check check (offer_type in ('PACKAGE','DISCOUNT','BUY_X_GET_Y','FREE_SERVICE','CREDIT','FIXED_PRICE')),
  constraint offers_status_check check (status in ('DRAFT','SCHEDULED','ACTIVE','PAUSED','EXPIRED','ARCHIVED')),
  constraint offers_audience_type_check check (audience_type in ('all','selected_users')),
  constraint offers_user_segment_check check (user_segment in ('new','old','all')),
  constraint offers_validity_mode_check check (validity_mode in ('fixed_dates','days_from_purchase','days_from_issue','days_from_first_use','no_expiry'))
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'offers_current_version_fk'
      and conrelid = 'zigo.offers'::regclass
  ) then
    alter table zigo.offers
      add constraint offers_current_version_fk foreign key (current_version_id) references zigo.offer_versions(id) not valid;
  end if;
end $$;

create table if not exists zigo.offer_scopes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  scope_type text not null default 'all',
  state_id uuid references zigo.states(id),
  city_id uuid references zigo.cities(id),
  zone_id uuid references zigo.zones(id),
  cluster_id uuid references zigo.clusters(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offer_scopes_scope_type_check check (scope_type in ('all','state','city','zone','cluster'))
);

create table if not exists zigo.offer_included_users (
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  user_id uuid not null references zigo.users(id),
  created_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);

create table if not exists zigo.offer_excluded_users (
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  user_id uuid not null references zigo.users(id),
  created_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);

create table if not exists zigo.offer_services (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  service_master_id uuid references zigo.category_service_masters(id),
  service_id uuid references zigo.services(id),
  created_at timestamptz not null default now(),
  constraint offer_services_one_source_check check (service_master_id is not null or service_id is not null)
);

create table if not exists zigo.offer_categories (
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  category_id uuid not null references zigo.categories(id),
  created_at timestamptz not null default now(),
  primary key (offer_id, category_id)
);

create table if not exists zigo.offer_booking_types (
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  booking_type text not null,
  created_at timestamptz not null default now(),
  primary key (offer_id, booking_type),
  constraint offer_booking_types_check check (booking_type in ('instant','schedule','both'))
);

create table if not exists zigo.offer_durations (
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  category_price_rule_id uuid not null references zigo.category_price_rules(id),
  created_at timestamptz not null default now(),
  primary key (offer_id, category_price_rule_id)
);

create table if not exists zigo.offer_payment_modes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  payment_mode_id uuid references zigo.payment_mode_masters(id),
  payment_mode_code text,
  created_at timestamptz not null default now(),
  constraint offer_payment_modes_one_source_check check (payment_mode_id is not null or payment_mode_code is not null)
);

create table if not exists zigo.offer_referral_codes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  assistant_id uuid references zigo.assistants(id),
  code text not null,
  reward_type text not null default 'none',
  reward_value numeric(12,2) not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code)
);

create table if not exists zigo.offer_content_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id) on delete cascade,
  content_type text not null,
  title text,
  subtitle text,
  body text,
  icon_url text,
  image_url text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offer_content_items_type_check check (content_type in ('service','do','dont','term'))
);

create table if not exists zigo.offer_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id),
  offer_version_id uuid references zigo.offer_versions(id),
  customer_id uuid not null references zigo.users(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  amount_paise integer not null default 0,
  currency text not null default 'INR',
  status text not null default 'CREATED',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists zigo.user_offer_entitlements (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id),
  offer_version_id uuid references zigo.offer_versions(id),
  purchase_order_id uuid references zigo.offer_purchase_orders(id),
  customer_id uuid not null references zigo.users(id),
  total_units integer not null default 1,
  remaining_units integer not null default 1,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_offer_entitlements_status_check check (status in ('ACTIVE','EXHAUSTED','EXPIRED','REVOKED'))
);

create table if not exists zigo.offer_redemption_ledger (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id),
  offer_version_id uuid references zigo.offer_versions(id),
  entitlement_id uuid references zigo.user_offer_entitlements(id),
  booking_id uuid references zigo.bookings(id),
  customer_id uuid not null references zigo.users(id),
  status text not null default 'RESERVED',
  benefit_type text not null default 'none',
  benefit_amount_paise integer not null default 0,
  idempotency_key text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_redemption_ledger_status_check check (status in ('RESERVED','CONSUMED','RELEASED','REVERSED')),
  unique (idempotency_key)
);

create table if not exists zigo.offer_referral_attributions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references zigo.offers(id),
  referral_code_id uuid references zigo.offer_referral_codes(id),
  assistant_id uuid references zigo.assistants(id),
  customer_id uuid not null references zigo.users(id),
  booking_id uuid references zigo.bookings(id),
  purchase_order_id uuid references zigo.offer_purchase_orders(id),
  status text not null default 'PENDING',
  reward_amount_paise integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.offer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references zigo.offers(id),
  actor_user_id uuid references zigo.users(id),
  action text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_offers_status_active on zigo.offers(status, is_active, is_enabled, is_deleted);
create unique index if not exists idx_offers_public_code_unique on zigo.offers(lower(public_code)) where public_code is not null and public_code <> '' and is_deleted = false;
create index if not exists idx_offer_scopes_offer on zigo.offer_scopes(offer_id, scope_type, cluster_id, zone_id, city_id, state_id);
create unique index if not exists idx_offer_services_master_unique on zigo.offer_services(offer_id, service_master_id) where service_master_id is not null;
create unique index if not exists idx_offer_services_legacy_unique on zigo.offer_services(offer_id, service_id) where service_id is not null;
create unique index if not exists idx_offer_payment_modes_id_unique on zigo.offer_payment_modes(offer_id, payment_mode_id) where payment_mode_id is not null;
create unique index if not exists idx_offer_payment_modes_code_unique on zigo.offer_payment_modes(offer_id, lower(payment_mode_code)) where payment_mode_code is not null and payment_mode_code <> '';
create index if not exists idx_offer_redemption_customer on zigo.offer_redemption_ledger(customer_id, offer_id, status);
create index if not exists idx_offer_entitlements_customer on zigo.user_offer_entitlements(customer_id, status, valid_until);
create index if not exists idx_category_price_offer_flags on zigo.category_price_rules(is_offer_eligible, is_duration_for_offers);
