create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'zigo' and t.typname = 'lifecycle_status'
  ) then
    create type zigo.lifecycle_status as enum ('draft', 'active', 'inactive', 'retired');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'zigo' and t.typname = 'review_status'
  ) then
    create type zigo.review_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'zigo' and t.typname = 'booking_status'
  ) then
    create type zigo.booking_status as enum (
      'draft',
      'needs_input',
      'quoted',
      'confirmed',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'zigo' and t.typname = 'task_status'
  ) then
    create type zigo.task_status as enum (
      'pending',
      'ready',
      'assigned',
      'in_progress',
      'completed',
      'failed',
      'cancelled'
    );
  end if;
end
$$;

alter table zigo.services
  add column if not exists default_booking_mode text not null default 'task',
  add column if not exists status zigo.lifecycle_status not null default 'draft';

update zigo.services
set status = case
  when is_active and is_enabled and not is_deleted then 'active'::zigo.lifecycle_status
  when is_deleted then 'retired'::zigo.lifecycle_status
  else 'inactive'::zigo.lifecycle_status
end
where metadata ->> 'catalogSource' is distinct from 'zigo_personal_assistant_v2';

create table if not exists zigo.service_pillars (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  display_order integer not null default 0,
  status zigo.lifecycle_status not null default 'draft'
);

create table if not exists zigo.service_pillar_mappings (
  service_id uuid not null references zigo.services(id) on delete cascade,
  pillar_id uuid not null references zigo.service_pillars(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (service_id, pillar_id)
);

create table if not exists zigo.task_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  task_family text not null,
  risk_tier text not null default 'standard',
  status zigo.lifecycle_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.service_task_mappings (
  service_id uuid not null references zigo.services(id) on delete cascade,
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  display_order integer not null default 0,
  primary key (service_id, task_id)
);

create table if not exists zigo.task_input_definitions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  field_key text not null,
  label text not null,
  data_type text not null,
  required_when jsonb not null default '{}'::jsonb,
  validation_schema jsonb not null default '{}'::jsonb,
  sensitive boolean not null default false,
  customer_confirmation_required boolean not null default false,
  unique (task_id, field_key)
);

create table if not exists zigo.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  status zigo.lifecycle_status not null default 'draft',
  unique (task_id, version)
);

create table if not exists zigo.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references zigo.workflow_templates(id) on delete cascade,
  step_key text not null,
  instruction text not null,
  step_order integer not null check (step_order > 0),
  depends_on_keys text[] not null default '{}',
  evidence_required boolean not null default false,
  failure_action text,
  unique (workflow_id, step_key),
  unique (workflow_id, step_order)
);

create table if not exists zigo.capabilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  requires_training boolean not null default false
);

create table if not exists zigo.task_capability_requirements (
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  capability_id uuid not null references zigo.capabilities(id) on delete cascade,
  required boolean not null default true,
  primary key (task_id, capability_id)
);

create table if not exists zigo.validation_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references zigo.task_definitions(id) on delete cascade,
  code text not null unique,
  version integer not null default 1 check (version > 0),
  rule_type text not null,
  conditions jsonb not null default '{}'::jsonb,
  decision text not null,
  status zigo.lifecycle_status not null default 'draft'
);

create table if not exists zigo.duration_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  version integer not null check (version > 0),
  base_minutes integer not null check (base_minutes >= 0),
  travel_buffer_minutes integer not null default 0 check (travel_buffer_minutes >= 0),
  waiting_policy jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft',
  unique (task_id, version)
);

-- The production pricing_rules table remains the current category/service engine.
-- V2 task-level pricing is isolated so unfinished rules cannot affect live quotes.
create table if not exists zigo.task_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references zigo.task_definitions(id) on delete cascade,
  version integer not null check (version > 0),
  currency char(3) not null default 'INR',
  base_fee numeric(12, 2) not null default 0 check (base_fee >= 0),
  minute_rate numeric(12, 2) not null default 0 check (minute_rate >= 0),
  km_rate numeric(12, 2) not null default 0 check (km_rate >= 0),
  minimum_fee numeric(12, 2) not null default 0 check (minimum_fee >= 0),
  extras jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_until timestamptz,
  status zigo.lifecycle_status not null default 'draft',
  unique (task_id, version),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists zigo.question_templates (
  id uuid primary key default gen_random_uuid(),
  task_input_id uuid references zigo.task_input_definitions(id) on delete cascade,
  question_key text not null unique,
  language_code text not null default 'en',
  prompt_text text not null,
  priority integer not null default 100,
  status zigo.lifecycle_status not null default 'draft'
);

create table if not exists zigo.completion_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  version integer not null check (version > 0),
  evidence_types text[] not null default '{}',
  customer_confirmation_required boolean not null default false,
  criteria jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft',
  unique (task_id, version)
);

create table if not exists zigo.policy_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  policy_type text not null,
  version integer not null check (version > 0),
  conditions jsonb not null default '{}'::jsonb,
  outcome jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft'
);

create table if not exists zigo.exception_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  severity text not null,
  default_action text not null
);

create table if not exists zigo.service_zones (
  id uuid primary key default gen_random_uuid(),
  source_zone_id uuid unique references zigo.zones(id) on delete set null,
  code text not null unique,
  name text not null,
  geojson jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.task_zone_availability (
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  zone_id uuid not null references zigo.service_zones(id) on delete cascade,
  is_available boolean not null default true,
  primary key (task_id, zone_id)
);

create table if not exists zigo.booking_modes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  included_minutes integer check (included_minutes is null or included_minutes > 0),
  settings jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft'
);

create index if not exists idx_service_pillar_mappings_pillar
  on zigo.service_pillar_mappings(pillar_id, service_id);

create index if not exists idx_service_task_mappings_task
  on zigo.service_task_mappings(task_id, service_id);

create index if not exists idx_task_definitions_family_status
  on zigo.task_definitions(task_family, status);

create index if not exists idx_task_input_definitions_task
  on zigo.task_input_definitions(task_id);

create index if not exists idx_workflow_templates_task_status
  on zigo.workflow_templates(task_id, status);

create index if not exists idx_task_pricing_rules_task_effective
  on zigo.task_pricing_rules(task_id, effective_from desc);

create index if not exists idx_task_zone_availability_zone
  on zigo.task_zone_availability(zone_id, is_available);
