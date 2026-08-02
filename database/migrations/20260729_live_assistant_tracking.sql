alter table if exists zigo.assistant_availability
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7);

create table if not exists zigo.assistant_location_pings (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references zigo.assistants(id) on delete cascade,
  request_id uuid references zigo.service_requests(id) on delete set null,
  service_request_id uuid references zigo.service_requests(id) on delete set null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_meters numeric(8,2),
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_location_pings_assistant_created
  on zigo.assistant_location_pings (assistant_id, created_at desc);

create index if not exists idx_assistant_location_pings_request
  on zigo.assistant_location_pings (service_request_id, created_at desc);
