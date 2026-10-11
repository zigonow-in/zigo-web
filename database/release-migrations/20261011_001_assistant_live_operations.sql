do $migration$
begin
  if to_regclass('zigo.app_settings') is null
    or to_regclass('zigo.booking_task_update_reads') is null
    or to_regclass('zigo.assistant_availability') is null
    or to_regclass('zigo.assistant_location_pings') is null
    or to_regclass('zigo.booking_realtime_events') is null
    or to_regclass('zigo.task_assignments') is null then
    raise exception 'Required base schema is missing. Apply the existing base migrations before this release.';
  end if;
end
$migration$;

alter table zigo.booking_task_update_reads
  add column if not exists delivered_at timestamptz;

alter table zigo.booking_task_update_reads
  alter column read_at drop not null,
  alter column read_at drop default;

alter table zigo.assistant_availability
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists gps_captured_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists presence_status text;

alter table zigo.assistant_location_pings
  add column if not exists request_id uuid references zigo.service_requests(id) on delete set null,
  add column if not exists service_request_id uuid references zigo.service_requests(id) on delete set null,
  add column if not exists accuracy_meters numeric(8,2),
  add column if not exists captured_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table zigo.assistant_location_pings
  alter column request_id drop not null,
  alter column service_request_id drop not null;

alter table zigo.booking_realtime_events
  add column if not exists assistant_id uuid,
  add column if not exists cluster_id uuid;

insert into zigo.app_settings ("key", value, description, is_active)
values (
  'assistant.master_values',
  '{"broadcastTimeSeconds":30,"autoArrivedRadiusMeters":100,"dryRunDistanceKm":3,"travelCostSlabs":[{"fromKm":0,"toKm":3,"rateType":"fixed","ratePaise":5000},{"fromKm":3,"toKm":5,"rateType":"per_km","ratePaise":1000},{"fromKm":5,"toKm":10,"rateType":"per_km","ratePaise":900},{"fromKm":10,"toKm":15,"rateType":"per_km","ratePaise":800},{"fromKm":15,"toKm":20,"rateType":"per_km","ratePaise":700}],"assistantTravelPayoutSlabs":[{"fromKm":0,"toKm":3,"rateType":"fixed","ratePaise":5000},{"fromKm":3,"toKm":5,"rateType":"per_km","ratePaise":1000},{"fromKm":5,"toKm":10,"rateType":"per_km","ratePaise":900},{"fromKm":10,"toKm":15,"rateType":"per_km","ratePaise":800},{"fromKm":15,"toKm":20,"rateType":"per_km","ratePaise":700}]}',
  'Assistant broadcast, arrival radius, dry run, travel cost, and travel payout master values',
  true
)
on conflict ("key") do nothing;
