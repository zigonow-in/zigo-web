import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    create extension if not exists pgcrypto;
    create schema if not exists zigo;

    create table if not exists zigo.states (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      country_name text not null default 'India',
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.cities (
      id uuid primary key default gen_random_uuid(),
      state_id uuid references zigo.states(id),
      code text not null unique,
      name text not null,
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.zones (
      id uuid primary key default gen_random_uuid(),
      city_id uuid references zigo.cities(id),
      code text not null unique,
      name text not null,
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.services (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      description text,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.stores (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      address text,
      latitude numeric(10, 7),
      longitude numeric(10, 7),
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.category_store_map (
      id uuid primary key default gen_random_uuid(),
      category_id uuid not null references zigo.categories(id) on delete cascade,
      store_id uuid not null references zigo.stores(id) on delete cascade,
      is_active boolean not null default true,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false,
      unique(category_id, store_id)
    );

    create table if not exists zigo.cluster_store_map (
      id uuid primary key default gen_random_uuid(),
      cluster_id uuid not null references zigo.clusters(id) on delete cascade,
      store_id uuid not null references zigo.stores(id) on delete cascade,
      is_active boolean not null default true,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false,
      unique(cluster_id, store_id)
    );

    alter table zigo.clusters
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists description text,
      add column if not exists areas_description text,
      add column if not exists polygon_description text,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.states
      add column if not exists code text,
      add column if not exists name text,
      add column if not exists country_name text not null default 'India',
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.cities
      add column if not exists state_id uuid references zigo.states(id),
      add column if not exists code text,
      add column if not exists name text,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.zones
      add column if not exists city_id uuid references zigo.cities(id),
      add column if not exists code text,
      add column if not exists name text,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.services
      add column if not exists code text,
      add column if not exists name text,
      add column if not exists description text,
      add column if not exists image_url text,
      add column if not exists priority integer not null default 0,
      add column if not exists is_recommended boolean not null default false,
      add column if not exists is_enabled boolean not null default true,
      add column if not exists is_active boolean not null default true,
      add column if not exists sort_order integer not null default 0,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.stores
      add column if not exists code text,
      add column if not exists name text,
      add column if not exists description text,
      add column if not exists address text,
      add column if not exists contact text,
      add column if not exists website text,
      add column if not exists latitude numeric(10, 7),
      add column if not exists longitude numeric(10, 7),
      add column if not exists priority integer not null default 0,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'zigo' and table_name = 'stores' and column_name = 'place_id'
      ) then
        alter table zigo.stores alter column place_id drop not null;
      end if;
    end $$;

    create table if not exists zigo.store_categories (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      image_url text,
      description text,
      priority integer not null default 0,
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.store_images (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references zigo.stores(id) on delete cascade,
      file_id uuid references zigo.files(id),
      image_url text not null,
      is_primary boolean not null default false,
      priority integer not null default 0,
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.store_keywords (
      id uuid primary key default gen_random_uuid(),
      service_id uuid not null references zigo.services(id),
      service_category_id uuid not null references zigo.categories(id),
      code text not null unique,
      name text not null,
      description text,
      priority integer not null default 0,
      is_active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    create table if not exists zigo.store_keyword_map (
      id uuid primary key default gen_random_uuid(),
      store_keyword_id uuid not null references zigo.store_keywords(id) on delete cascade,
      store_id uuid not null references zigo.stores(id) on delete cascade,
      is_active boolean not null default true,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false,
      unique(store_keyword_id, store_id)
    );

    create table if not exists zigo.store_category_map (
      id uuid primary key default gen_random_uuid(),
      store_category_id uuid not null references zigo.store_categories(id) on delete cascade,
      store_id uuid not null references zigo.stores(id) on delete cascade,
      is_active boolean not null default true,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false,
      unique(store_category_id, store_id)
    );

    alter table zigo.store_categories
      add column if not exists service_id uuid references zigo.services(id),
      add column if not exists service_category_id uuid references zigo.categories(id),
      add column if not exists image_url text,
      add column if not exists description text,
      add column if not exists priority integer not null default 0,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.store_images
      add column if not exists file_id uuid references zigo.files(id),
      add column if not exists image_url text,
      add column if not exists is_primary boolean not null default false,
      add column if not exists priority integer not null default 0,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.store_keywords
      add column if not exists service_id uuid references zigo.services(id),
      add column if not exists service_category_id uuid references zigo.categories(id),
      add column if not exists description text,
      add column if not exists priority integer not null default 0,
      add column if not exists is_active boolean not null default true,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.store_keyword_map
      add column if not exists is_deleted boolean not null default false,
      add column if not exists is_active boolean not null default true,
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz;

    alter table zigo.categories
      add column if not exists service_id uuid references zigo.services(id),
      add column if not exists image_url text,
      add column if not exists priority integer not null default 0,
      add column if not exists is_recommended boolean not null default false,
      add column if not exists is_enabled boolean not null default true,
      add column if not exists is_active boolean not null default true,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.assistant_vehicles
      add column if not exists is_deleted boolean not null default false,
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz;

    create index if not exists idx_states_active on zigo.states(is_deleted, is_active, name);
    create index if not exists idx_cities_active on zigo.cities(is_deleted, is_active, name);
    create index if not exists idx_zones_active on zigo.zones(is_deleted, is_active, name);
    create index if not exists idx_services_active on zigo.services(is_deleted, is_active, is_enabled, priority, sort_order, name);
    create index if not exists idx_stores_active on zigo.stores(is_deleted, is_active, name);
    create index if not exists idx_categories_active on zigo.categories(is_deleted, is_active, is_enabled, priority, sort_order, name);
    create index if not exists idx_store_categories_active on zigo.store_categories(is_deleted, is_active, priority, name);
    create index if not exists idx_store_categories_parent_active on zigo.store_categories(service_id, service_category_id, is_deleted, is_active);
    create index if not exists idx_store_keywords_parent_active on zigo.store_keywords(service_id, service_category_id, is_deleted, is_active, priority, name);
    create index if not exists idx_store_keyword_map_store on zigo.store_keyword_map(store_id, is_deleted, is_active);
    create index if not exists idx_store_images_store on zigo.store_images(store_id, is_deleted, is_primary, priority);
  `);

  console.log("Admin master pages migration completed.");
} finally {
  await pool.end();
}
