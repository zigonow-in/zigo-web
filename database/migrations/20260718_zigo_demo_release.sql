-- Zigo Demo release migration - 2026-07-18
-- Safe/idempotent migration for recent application changes.
-- No full database dump. No destructive statements.

create table if not exists zigo.category_service_masters (
  id uuid primary key default gen_random_uuid(),
  service_title text not null default '',
  service_subtitle text,
  static_value text,
  show_static_value boolean not null default true,
  icons jsonb not null default '[]'::jsonb,
  service_title_font_size integer not null default 18,
  service_title_font_weight integer not null default 400,
  service_title_color text not null default '',
  service_subtitle_font_size integer not null default 13,
  service_subtitle_font_weight integer not null default 400,
  service_subtitle_color text not null default '',
  booking_type text not null default 'both',
  show_eta boolean not null default false,
  service_position integer not null default 0,
  service_category_grid_size text not null default '3x3',
  is_enabled boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references zigo.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references zigo.users(id),
  updated_at timestamptz not null default now(),
  deleted_by uuid references zigo.users(id),
  deleted_at timestamptz,
  is_deleted boolean not null default false
);

alter table zigo.category_service_masters
  add column if not exists service_title text not null default '',
  add column if not exists service_subtitle text,
  add column if not exists static_value text,
  add column if not exists show_static_value boolean not null default true,
  add column if not exists icons jsonb not null default '[]'::jsonb,
  add column if not exists service_title_font_size integer not null default 18,
  add column if not exists service_title_font_weight integer not null default 400,
  add column if not exists service_title_color text not null default '',
  add column if not exists service_subtitle_font_size integer not null default 13,
  add column if not exists service_subtitle_font_weight integer not null default 400,
  add column if not exists service_subtitle_color text not null default '',
  add column if not exists booking_type text not null default 'both',
  add column if not exists show_eta boolean not null default false,
  add column if not exists service_position integer not null default 0,
  add column if not exists service_category_grid_size text not null default '3x3',
  add column if not exists is_enabled boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references zigo.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_by uuid references zigo.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_by uuid references zigo.users(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_category_service_masters_active
  on zigo.category_service_masters(is_deleted, is_active, is_enabled, service_position);

alter table zigo.categories
  add column if not exists config jsonb not null default '{}'::jsonb;

create table if not exists zigo.category_price_rules (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'all',
  state_id uuid references zigo.states(id),
  city_id uuid references zigo.cities(id),
  zone_id uuid references zigo.zones(id),
  cluster_id uuid references zigo.clusters(id),
  category_id uuid references zigo.categories(id),
  time_duration_minutes integer not null default 0,
  base_price numeric(12,2) not null default 0,
  discount_type text not null default 'none',
  discount_value numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  waiting_charge_amount numeric(12,2) not null default 0,
  waiting_charge_time_minutes integer not null default 0,
  available_for_duration boolean not null default true,
  available_for_extend boolean not null default false,
  available_for_expand boolean not null default false,
  slab jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references zigo.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references zigo.users(id),
  updated_at timestamptz not null default now(),
  deleted_by uuid references zigo.users(id),
  deleted_at timestamptz,
  is_deleted boolean not null default false
);

alter table zigo.category_price_rules
  add column if not exists scope_type text not null default 'all',
  add column if not exists state_id uuid references zigo.states(id),
  add column if not exists city_id uuid references zigo.cities(id),
  add column if not exists zone_id uuid references zigo.zones(id),
  add column if not exists cluster_id uuid references zigo.clusters(id),
  add column if not exists category_id uuid references zigo.categories(id),
  add column if not exists time_duration_minutes integer not null default 0,
  add column if not exists base_price numeric(12,2) not null default 0,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists selling_price numeric(12,2) not null default 0,
  add column if not exists waiting_charge_amount numeric(12,2) not null default 0,
  add column if not exists waiting_charge_time_minutes integer not null default 0,
  add column if not exists available_for_duration boolean not null default true,
  add column if not exists available_for_extend boolean not null default false,
  add column if not exists available_for_expand boolean not null default false,
  add column if not exists slab jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references zigo.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_by uuid references zigo.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_by uuid references zigo.users(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_category_price_rules_active
  on zigo.category_price_rules(is_deleted, is_active, is_enabled, category_id);
create index if not exists idx_category_price_rules_location_scope
  on zigo.category_price_rules(scope_type, state_id, city_id, zone_id, cluster_id);

create table if not exists zigo.payment_mode_masters (
  id uuid primary key default gen_random_uuid(),
  code text not null default '',
  name text not null default '',
  scope_type text not null default 'all',
  state_id uuid references zigo.states(id),
  city_id uuid references zigo.cities(id),
  zone_id uuid references zigo.zones(id),
  cluster_id uuid references zigo.clusters(id),
  sort_order integer not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references zigo.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references zigo.users(id),
  updated_at timestamptz not null default now(),
  deleted_by uuid references zigo.users(id),
  deleted_at timestamptz,
  is_deleted boolean not null default false
);

alter table zigo.payment_mode_masters
  add column if not exists code text not null default '',
  add column if not exists name text not null default '',
  add column if not exists scope_type text not null default 'all',
  add column if not exists state_id uuid references zigo.states(id),
  add column if not exists city_id uuid references zigo.cities(id),
  add column if not exists zone_id uuid references zigo.zones(id),
  add column if not exists cluster_id uuid references zigo.clusters(id),
  add column if not exists sort_order integer not null default 0,
  add column if not exists description text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references zigo.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_by uuid references zigo.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_by uuid references zigo.users(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

create unique index if not exists ux_payment_mode_masters_scope_code
  on zigo.payment_mode_masters(
    lower(code),
    scope_type,
    coalesce(state_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where coalesce(is_deleted, false) = false;

create index if not exists idx_payment_mode_masters_active
  on zigo.payment_mode_masters(is_deleted, is_active, is_enabled, scope_type, sort_order);

create table if not exists zigo.razorpay_payments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid references zigo.service_requests(id) on delete set null,
  customer_user_id uuid references zigo.users(id) on delete set null,
  provider_order_id text not null unique,
  provider_payment_id text,
  amount_paise integer not null,
  currency text not null default 'INR',
  receipt text,
  status_code text not null default 'pending',
  method text,
  bank text,
  wallet text,
  vpa text,
  email text,
  contact text,
  error_code text,
  error_description text,
  captured_at timestamptz,
  verified_at timestamptz,
  last_reconciled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  raw_order jsonb not null default '{}'::jsonb,
  raw_payment jsonb not null default '{}'::jsonb,
  webhook_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  event_name text not null,
  provider_order_id text,
  provider_payment_id text,
  payload jsonb not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique(event_id)
);

create table if not exists zigo.razorpay_downtimes (
  id text primary key,
  method text,
  status_code text,
  severity text,
  instrument jsonb not null default '{}'::jsonb,
  begin_at timestamptz,
  end_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table zigo.service_requests
  add column if not exists payment_details jsonb not null default '{}'::jsonb,
  add column if not exists payment_status text not null default 'due',
  add column if not exists payment_type text not null default 'cash',
  add column if not exists is_paid boolean not null default false;

create index if not exists idx_razorpay_payments_booking
  on zigo.razorpay_payments(service_request_id, created_at desc);
create index if not exists idx_razorpay_payments_status
  on zigo.razorpay_payments(status_code, updated_at desc);
create index if not exists idx_razorpay_payments_payment
  on zigo.razorpay_payments(provider_payment_id);
create index if not exists idx_razorpay_webhook_order
  on zigo.razorpay_webhook_events(provider_order_id, received_at desc);
