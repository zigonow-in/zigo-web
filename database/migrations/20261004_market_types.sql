begin;
create table if not exists zigo.market_types (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  code varchar(100) not null,
  description text not null default '',
  color varchar(7) not null default '#005df2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists market_types_code_live_idx on zigo.market_types (lower(code)) where is_deleted = false;
create index if not exists market_types_name_live_idx on zigo.market_types (lower(name), id) where is_deleted = false;
commit;
