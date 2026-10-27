-- Add-on scopes now reference the location masters instead of free text.
alter table if exists zigo.addon_charge_masters
  add column if not exists scope_type text not null default 'all',
  add column if not exists state_id uuid references zigo.states(id),
  add column if not exists city_id uuid references zigo.cities(id),
  add column if not exists zone_id uuid references zigo.zones(id),
  add column if not exists cluster_id uuid references zigo.clusters(id),
  add column if not exists micro_market_id uuid references zigo.micro_markets(id),
  add column if not exists nano_market_id uuid references zigo.nano_markets(id);

create index if not exists idx_addon_charge_masters_location_scope
  on zigo.addon_charge_masters(scope_type, state_id, city_id, zone_id, cluster_id, micro_market_id, nano_market_id);

alter table if exists zigo.booking_addon_charge_lines
  add column if not exists scope_type text not null default 'all',
  add column if not exists state_id uuid,
  add column if not exists city_id uuid,
  add column if not exists zone_id uuid,
  add column if not exists cluster_id uuid,
  add column if not exists micro_market_id uuid,
  add column if not exists nano_market_id uuid;
