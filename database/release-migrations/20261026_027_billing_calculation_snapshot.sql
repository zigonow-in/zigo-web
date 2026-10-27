-- Persist the complete booking calculation so Track Booking and reporting read
-- the values charged at confirmation time, independent of current master data.
alter table if exists zigo.booking_billing_snapshots
  add column if not exists item_base_price_paise bigint not null default 0,
  add column if not exists item_discount_paise bigint not null default 0,
  add column if not exists item_selling_price_paise bigint not null default 0,
  add column if not exists item_taxable_after_discount_paise bigint not null default 0,
  add column if not exists item_tax_inclusive_paise bigint not null default 0,
  add column if not exists item_tax_exclusive_paise bigint not null default 0,
  add column if not exists addon_total_paise bigint not null default 0,
  add column if not exists addon_discount_paise bigint not null default 0,
  add column if not exists addon_taxable_after_discount_paise bigint not null default 0,
  add column if not exists addon_tax_inclusive_paise bigint not null default 0,
  add column if not exists addon_tax_exclusive_paise bigint not null default 0,
  add column if not exists original_delivery_charges_paise bigint not null default 0,
  add column if not exists delivery_discount_paise bigint not null default 0,
  add column if not exists delivery_charges_paise bigint not null default 0,
  add column if not exists total_discount_paise bigint not null default 0,
  add column if not exists subtotal_after_discount_paise bigint not null default 0,
  add column if not exists pre_round_total_paise bigint not null default 0,
  add column if not exists rounding_adjustment_paise bigint not null default 0,
  add column if not exists amount_to_pay_paise bigint not null default 0;

create table if not exists zigo.booking_item_charge_lines (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  line_sequence integer not null default 1,
  item_type text not null default 'category',
  service_id uuid,
  category_id uuid,
  service_name text not null default '',
  category_name text not null default '',
  base_price_paise bigint not null default 0,
  discount_type text not null default 'none',
  discount_value numeric(12,2) not null default 0,
  discount_amount_paise bigint not null default 0,
  selling_price_paise bigint not null default 0,
  taxable_after_discount_paise bigint not null default 0,
  item_total_paise bigint not null default 0,
  tax_inclusive_paise bigint not null default 0,
  tax_exclusive_paise bigint not null default 0,
  tax_amount_paise bigint not null default 0,
  total_amount_paise bigint not null default 0,
  rounding_adjustment_paise bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_item_charge_lines_booking
  on zigo.booking_item_charge_lines(service_request_id, line_sequence, created_at);

alter table if exists zigo.booking_addon_charge_lines
  add column if not exists raw_gross_amount_paise bigint not null default 0,
  add column if not exists raw_net_amount_paise bigint not null default 0,
  add column if not exists taxable_after_discount_paise bigint not null default 0,
  add column if not exists amount_after_discount_paise bigint not null default 0,
  add column if not exists inclusive_tax_amount_paise bigint not null default 0,
  add column if not exists exclusive_tax_amount_paise bigint not null default 0,
  add column if not exists tax_amount_paise bigint not null default 0,
  add column if not exists total_amount_paise bigint not null default 0,
  add column if not exists rounding_adjustment_paise bigint not null default 0;

alter table if exists zigo.booking_add_on_payments
  add column if not exists raw_gross_amount_paise bigint not null default 0,
  add column if not exists raw_net_amount_paise bigint not null default 0,
  add column if not exists taxable_after_discount_paise bigint not null default 0,
  add column if not exists amount_after_discount_paise bigint not null default 0,
  add column if not exists inclusive_tax_amount_paise bigint not null default 0,
  add column if not exists exclusive_tax_amount_paise bigint not null default 0,
  add column if not exists rounding_adjustment_paise bigint not null default 0;
