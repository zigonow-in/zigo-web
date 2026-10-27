create table if not exists zigo.service_category_masters (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid references zigo.service_pillars(id),
  code text not null unique,
  name text not null,
  description text,
  media_urls jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  status zigo.lifecycle_status not null default 'draft',
  is_active boolean not null default true,
  created_by uuid references zigo.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references zigo.users(id),
  updated_at timestamptz not null default now(),
  deleted_by uuid references zigo.users(id),
  deleted_at timestamptz,
  is_deleted boolean not null default false
);

alter table zigo.service_category_masters
  alter column pillar_id drop not null,
  add column if not exists media_urls jsonb not null default '[]'::jsonb,
  add column if not exists is_active boolean not null default true;

create table if not exists zigo.service_category_service_mappings (
  service_category_id uuid not null references zigo.service_category_masters(id) on delete cascade,
  service_id uuid not null references zigo.services(id) on delete cascade,
  display_order integer not null default 0,
  primary key (service_category_id, service_id)
);

create table if not exists zigo.service_category_pillar_mappings (
  service_category_id uuid not null references zigo.service_category_masters(id) on delete cascade,
  pillar_id uuid not null references zigo.service_pillars(id) on delete cascade,
  display_order integer not null default 0,
  primary key (service_category_id, pillar_id)
);

insert into zigo.service_category_pillar_mappings (service_category_id, pillar_id, display_order)
select id, pillar_id, 1
from zigo.service_category_masters
where pillar_id is not null
on conflict (service_category_id, pillar_id) do nothing;

create index if not exists idx_service_category_masters_pillar_order
  on zigo.service_category_masters(pillar_id, is_deleted, display_order, name);

create index if not exists idx_service_category_service_mappings_service
  on zigo.service_category_service_mappings(service_id, service_category_id);

create index if not exists idx_service_category_pillar_mappings_pillar
  on zigo.service_category_pillar_mappings(pillar_id, service_category_id);
