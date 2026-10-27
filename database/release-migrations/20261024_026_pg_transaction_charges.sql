-- PG transaction costs are internal payment-gateway expenses, not customer-facing surcharges.
-- Keep the configured master and the resolved per-booking cost for loss analysis.
create table if not exists zigo.pg_transaction_charge_masters (
  id uuid primary key default gen_random_uuid(),
  payment_mode text not null,
  charge_type text not null default 'percent',
  charge_value numeric(12,4) not null default 0,
  description text,
  is_active boolean not null default true,
  created_by uuid references zigo.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references zigo.users(id),
  updated_at timestamptz not null default now(),
  deleted_by uuid references zigo.users(id),
  deleted_at timestamptz,
  is_deleted boolean not null default false
);

create unique index if not exists ux_pg_transaction_charge_masters_mode
  on zigo.pg_transaction_charge_masters(lower(payment_mode))
  where coalesce(is_deleted, false) = false;

create index if not exists idx_pg_transaction_charge_masters_active
  on zigo.pg_transaction_charge_masters(is_deleted, is_active, payment_mode);

insert into zigo.pg_transaction_charge_masters (payment_mode, charge_type, charge_value, description)
values
  ('upi', 'percent', 0, 'UPI payment processing cost'),
  ('debit_card', 'percent', 0.95, 'Debit card payment processing cost'),
  ('credit_card', 'percent', 2.50, 'Credit card payment processing cost'),
  ('net_banking', 'percent', 0.95, 'Net banking payment processing cost'),
  ('wallet', 'percent', 0, 'Wallet payment processing cost'),
  ('cash', 'percent', 0, 'Cash has no payment gateway cost'),
  ('other', 'percent', 0, 'Fallback payment gateway cost')
on conflict do nothing;

alter table zigo.booking_billing_snapshots
  add column if not exists pg_transaction_charge_master_id uuid references zigo.pg_transaction_charge_masters(id) on delete set null,
  add column if not exists pg_transaction_payment_mode text not null default 'cash',
  add column if not exists pg_transaction_charge_type text not null default 'percent',
  add column if not exists pg_transaction_charge_value numeric(12,4) not null default 0,
  add column if not exists pg_transaction_charge_base_paise bigint not null default 0,
  add column if not exists pg_transaction_charge_paise bigint not null default 0;

create index if not exists idx_booking_billing_snapshots_pg_charge
  on zigo.booking_billing_snapshots(pg_transaction_payment_mode, pg_transaction_charge_paise);
