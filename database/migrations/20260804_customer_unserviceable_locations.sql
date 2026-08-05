create table if not exists zigo.customer_unserviceable_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references zigo.customers(id) on delete set null,
  user_id uuid references zigo.users(id) on delete set null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  location_title text,
  address_text text not null,
  state_name text,
  city_name text,
  postal_code text,
  hit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_unserviceable_locations_customer
  on zigo.customer_unserviceable_locations(customer_id, last_seen_at desc);

create index if not exists idx_customer_unserviceable_locations_seen
  on zigo.customer_unserviceable_locations(last_seen_at desc);

create index if not exists idx_customer_unserviceable_locations_area
  on zigo.customer_unserviceable_locations(state_name, city_name, postal_code);

create index if not exists idx_customer_unserviceable_locations_coords
  on zigo.customer_unserviceable_locations(customer_id, latitude, longitude);
