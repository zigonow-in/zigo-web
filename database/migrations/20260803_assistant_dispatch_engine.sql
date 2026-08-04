create extension if not exists btree_gist;

alter table if exists zigo.assistant_availability
  add column if not exists presence_status text not null default 'OFFLINE',
  add column if not exists work_status text not null default 'FREE',
  add column if not exists availability_confidence text not null default 'UNKNOWN',
  add column if not exists heartbeat_at timestamptz,
  add column if not exists gps_captured_at timestamptz,
  add column if not exists next_available_at timestamptz,
  add column if not exists next_available_lat numeric(10,7),
  add column if not exists next_available_lng numeric(10,7),
  add column if not exists next_available_cluster_id uuid references zigo.clusters(id) on delete set null,
  add column if not exists status_updated_at timestamptz not null default now();

create table if not exists zigo.assistant_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references zigo.assistants(id) on delete cascade,
  block_type text not null,
  status_code text not null default 'active',
  source_type text,
  source_id uuid,
  cluster_id uuid references zigo.clusters(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  start_lat numeric(10,7),
  start_lng numeric(10,7),
  end_lat numeric(10,7),
  end_lng numeric(10,7),
  confidence text not null default 'EXPECTED',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (block_type in ('SHIFT', 'BOOKING', 'TEMPORARY_HOLD', 'TRAVEL', 'WRAP_UP', 'BREAK', 'TIME_OFF', 'ADMIN_BLOCK')),
  check (confidence in ('CONFIRMED', 'EXPECTED', 'UNKNOWN'))
);

create index if not exists idx_assistant_calendar_blocks_assistant_window
  on zigo.assistant_calendar_blocks (assistant_id, start_at, end_at)
  where status_code = 'active';

create index if not exists idx_assistant_calendar_blocks_source
  on zigo.assistant_calendar_blocks (source_type, source_id)
  where source_id is not null;

create index if not exists idx_assistant_calendar_blocks_cluster_window
  on zigo.assistant_calendar_blocks (cluster_id, start_at, end_at)
  where status_code = 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assistant_calendar_blocks_no_overlap'
      and conrelid = 'zigo.assistant_calendar_blocks'::regclass
  ) then
    alter table zigo.assistant_calendar_blocks
      add constraint assistant_calendar_blocks_no_overlap
      exclude using gist (
        assistant_id with =,
        tstzrange(start_at, end_at, '[)') with &&
      )
      where (
        status_code = 'active'
        and block_type in ('BOOKING', 'TEMPORARY_HOLD', 'TRAVEL', 'WRAP_UP', 'BREAK', 'TIME_OFF', 'ADMIN_BLOCK')
      );
  end if;
end $$;

