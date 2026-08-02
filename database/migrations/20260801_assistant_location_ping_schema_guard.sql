alter table if exists zigo.assistant_location_pings
  add column if not exists request_id uuid references zigo.service_requests(id) on delete set null,
  add column if not exists service_request_id uuid references zigo.service_requests(id) on delete set null,
  add column if not exists accuracy_meters numeric(8,2),
  add column if not exists captured_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table if exists zigo.assistant_location_pings
  alter column request_id drop not null,
  alter column service_request_id drop not null;

