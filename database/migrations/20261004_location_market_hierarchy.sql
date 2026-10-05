begin;

alter table zigo.zones add column if not exists polygon_description text;
alter table zigo.zones add column if not exists is_open boolean not null default true;
alter table zigo.cities add column if not exists service_region_code text;
alter table zigo.cities add column if not exists allow_intercity_service boolean not null default false;

create table if not exists zigo.micro_markets (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references zigo.clusters(id),
  name text not null,
  code text not null,
  polygon_description text,
  is_open boolean not null default false,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists micro_markets_parent_code on zigo.micro_markets(cluster_id, lower(code)) where is_deleted = false;
create index if not exists micro_markets_parent on zigo.micro_markets(cluster_id) where is_deleted = false;

create table if not exists zigo.nano_markets (
  id uuid primary key default gen_random_uuid(),
  micro_market_id uuid not null references zigo.micro_markets(id),
  name text not null,
  code text not null,
  polygon_description text,
  is_open boolean not null default false,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists nano_markets_parent_code on zigo.nano_markets(micro_market_id, lower(code)) where is_deleted = false;
create index if not exists nano_markets_parent on zigo.nano_markets(micro_market_id) where is_deleted = false;

commit;
