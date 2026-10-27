-- Add-on configuration and immutable booking billing lines.
-- This migration is additive so existing customers, bookings, and billing snapshots remain intact.
create table if not exists zigo.addon_charge_masters (
  id uuid primary key default gen_random_uuid(),
  addon_type text not null default 'service',
  scope text not null default 'all',
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
  is_deleted boolean not null default false
);

create index if not exists idx_addon_charge_masters_active
  on zigo.addon_charge_masters(is_deleted, is_active, addon_type, updated_at desc);

create table if not exists zigo.booking_addon_charge_lines (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  addon_charge_master_id uuid references zigo.addon_charge_masters(id),
  addon_type text not null,
  scope text not null default 'all',
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
