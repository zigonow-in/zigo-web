create table if not exists zigo.customer_wallets (
  customer_user_id uuid primary key references zigo.users(id) on delete restrict,
  available_balance_paise bigint not null default 0 check (available_balance_paise >= 0),
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.wallet_settlements (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references zigo.service_requests(id) on delete restrict,
  customer_user_id uuid not null references zigo.users(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR',
  razorpay_order_id text,
  razorpay_payment_id text,
  settled_by_user_id uuid references zigo.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists zigo.customer_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references zigo.users(id) on delete restrict,
  wallet_settlement_id uuid references zigo.wallet_settlements(id) on delete restrict,
  service_request_id uuid references zigo.service_requests(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('CANCELLATION_SETTLEMENT', 'BOOKING_PAYMENT', 'REVERSAL', 'ADJUSTMENT')),
  direction text not null check (direction in ('CREDIT', 'DEBIT')),
  amount_paise bigint not null check (amount_paise > 0),
  balance_before_paise bigint not null check (balance_before_paise >= 0),
  balance_after_paise bigint not null check (balance_after_paise >= 0),
  currency text not null default 'INR',
  idempotency_key text not null unique,
  status_code text not null default 'POSTED' check (status_code in ('POSTED', 'REVERSED')),
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references zigo.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_wallet_transactions_customer_created
  on zigo.customer_wallet_transactions(customer_user_id, created_at desc);
create index if not exists idx_customer_wallet_transactions_booking
  on zigo.customer_wallet_transactions(service_request_id, created_at desc);
create index if not exists idx_wallet_settlements_customer_created
  on zigo.wallet_settlements(customer_user_id, settled_at desc);
