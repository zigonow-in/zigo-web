import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const sql = `
create extension if not exists pgcrypto;
create schema if not exists zigo;

alter table if exists zigo.service_requests
  add column if not exists customer_id uuid,
  add column if not exists cluster_id uuid,
  add column if not exists category_id uuid,
  add column if not exists delivery_type_id uuid,
  add column if not exists status_code text not null default 'draft',
  add column if not exists notes text,
  add column if not exists duration_minutes integer not null default 30,
  add column if not exists estimated_amount_paise integer not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists accepted_assignment_id uuid,
  add column if not exists cancelled_reason text,
  add column if not exists completed_at timestamptz;

create table if not exists zigo.request_locations (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  sequence integer not null,
  location_type text not null default 'store',
  name text,
  address text not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(service_request_id, sequence)
);

create table if not exists zigo.assistant_availability (
  assistant_id uuid primary key references zigo.assistants(id) on delete cascade,
  status_code text not null default 'offline',
  cluster_id uuid,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  capacity integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists zigo.task_assignments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  assistant_id uuid not null references zigo.assistants(id),
  status_code text not null default 'offered',
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '5 minutes',
  reject_reason text,
  admin_reason text,
  created_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists zigo.task_events (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  assignment_id uuid references zigo.task_assignments(id) on delete set null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  notes text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists zigo.assistant_location_pings (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references zigo.assistants(id) on delete cascade,
  service_request_id uuid references zigo.service_requests(id) on delete set null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_meters numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists zigo.task_updates (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  assignment_id uuid references zigo.task_assignments(id) on delete set null,
  assistant_id uuid not null references zigo.assistants(id),
  update_type text not null,
  message text,
  amount_paise integer,
  image_urls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists zigo.customer_approvals (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  task_update_id uuid references zigo.task_updates(id) on delete set null,
  approval_type text not null,
  status_code text not null default 'pending',
  amount_paise integer,
  requested_message text,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists zigo.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  provider text not null default 'zaakpay',
  merchant_order_id text not null unique,
  provider_transaction_id text,
  amount_paise integer not null,
  currency text not null default 'INR',
  status_code text not null default 'created',
  checksum text,
  return_payload jsonb,
  webhook_payload jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  merchant_order_id text,
  provider_transaction_id text,
  event_status text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists zigo.settlements (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  assistant_id uuid references zigo.assistants(id),
  assistant_earning_paise integer not null default 0,
  platform_fee_paise integer not null default 0,
  refund_paise integer not null default 0,
  status_code text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.ratings (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  customer_id uuid references zigo.customers(id),
  assistant_id uuid references zigo.assistants(id),
  rating integer not null check (rating between 1 and 5),
  issue_flag boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists zigo.support_issues (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  opened_by_type text not null,
  opened_by_id uuid,
  status_code text not null default 'open',
  reason text not null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

`;

try {
  await pool.query(sql);
  await pool.query(`
    alter table if exists zigo.task_assignments
      add column if not exists service_request_id uuid,
      add column if not exists status_code text not null default 'offered',
      add column if not exists offered_at timestamptz not null default now(),
      add column if not exists responded_at timestamptz,
      add column if not exists expires_at timestamptz not null default now() + interval '5 minutes',
      add column if not exists reject_reason text,
      add column if not exists admin_reason text,
      add column if not exists created_by_user_id uuid;

    alter table if exists zigo.task_events
      add column if not exists service_request_id uuid,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists zigo.assistant_location_pings
      add column if not exists service_request_id uuid,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists zigo.payment_transactions
      add column if not exists service_request_id uuid,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists zigo.settlements
      add column if not exists service_request_id uuid;
  `);
  await pool.query(`
    create index if not exists idx_service_requests_live
      on zigo.service_requests(cluster_id, status_code, created_at desc);
    create index if not exists idx_task_assignments_assistant_live
      on zigo.task_assignments(assistant_id, status_code, offered_at desc);
    create index if not exists idx_task_events_request
      on zigo.task_events(service_request_id, created_at desc);
    create index if not exists idx_location_pings_request
      on zigo.assistant_location_pings(service_request_id, created_at desc);
    create index if not exists idx_payment_transactions_request
      on zigo.payment_transactions(service_request_id, created_at desc);
    create unique index if not exists idx_settlements_request_unique
      on zigo.settlements(service_request_id);
  `);
  console.log("MVP live flow migration completed");
} finally {
  await pool.end();
}
