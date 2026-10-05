begin;
create table if not exists zigo.nano_market_types (
  nano_market_id uuid not null references zigo.nano_markets(id) on delete cascade,
  market_type_id uuid not null references zigo.market_types(id),
  sort_order integer not null default 0,
  primary key(nano_market_id,market_type_id)
);
alter table zigo.nano_market_types add column if not exists sort_order integer not null default 0;
create index if not exists nano_market_types_type_idx on zigo.nano_market_types(market_type_id);
insert into zigo.nano_market_types(nano_market_id,market_type_id)
  select id,market_type_id from zigo.nano_markets where market_type_id is not null on conflict do nothing;
commit;
