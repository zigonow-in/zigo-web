create table if not exists zigo.tracking_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  booking_id uuid references zigo.service_requests(id) on delete cascade,
  assistant_id uuid references zigo.assistants(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  published_at timestamptz,
  publish_attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_tracking_outbox_dedupe_key on zigo.tracking_outbox(dedupe_key);
create index if not exists idx_tracking_outbox_pending on zigo.tracking_outbox(created_at) where published_at is null;
create index if not exists idx_tracking_outbox_booking on zigo.tracking_outbox(booking_id, created_at desc);