begin;
alter table zigo.nano_markets add column if not exists market_type_id uuid references zigo.market_types(id);
create index if not exists nano_markets_market_type_idx on zigo.nano_markets(market_type_id) where is_deleted = false;
commit;
