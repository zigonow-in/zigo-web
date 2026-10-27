create temporary table zigo_home_service_category_seed (
  category_code text primary key,
  category_name text not null,
  category_description text not null,
  category_order integer not null,
  service_codes text[] not null
) on commit drop;

insert into zigo_home_service_category_seed (category_code, category_name, category_description, category_order, service_codes)
values
  ('SC_HOME_SHOPPING_ERRANDS', 'Shopping & Household Errands', 'Help with household purchases, family errands and urgent pickups or purchases.', 1, array['SVC_SHOPPING_ERRANDS', 'SVC_URGENT_ERRANDS', 'SVC_FAMILY_ERRANDS']),
  ('SC_HOME_PICKUP_DELIVERY', 'Pickups, Laundry & Couriers', 'Help collecting and delivering items, handling laundry and repair errands, and dispatching parcels.', 2, array['SVC_ITEM_COLLECTION_DELIVERY', 'SVC_LAUNDRY_REPAIR', 'SVC_COURIER_SUPPORT']),
  ('SC_HOME_ORGANISATION_MOVING', 'Organising & Moving', 'Help sorting belongings, organising rooms, packing, unpacking and setting up a home.', 3, array['SVC_HOME_ORGANISATION', 'SVC_MOVING_HOME_SETUP']),
  ('SC_HOME_GUESTS_OCCASIONS', 'Guests & Occasions', 'Help preparing for guests, family celebrations, gatherings and events at home.', 4, array['SVC_FAMILY_OCCASIONS', 'SVC_HOME_GUEST_SUPPORT', 'SVC_BUSINESS_EVENT_SUPPORT']),
  ('SC_HOME_COORDINATION', 'Deliveries & Vendor Visits', 'Be present for home deliveries, coordinate vendor visits and follow household checklists.', 5, array['SVC_HOUSEHOLD_COORDINATION']),
  ('SC_HOME_DAY_ASSISTANCE', 'Help for the Day', 'Book an assistant for multiple household tasks and errands during a chosen period.', 6, array['SVC_PERSONAL_DAY']);

do $$
begin
  if exists (
    select 1
    from zigo_home_service_category_seed seed
    cross join lateral unnest(seed.service_codes) as required(service_code)
    left join zigo.services service
      on service.code = required.service_code
     and service.is_deleted = false
    where service.id is null
  ) then
    raise exception 'Home Service Category seed references a missing active Service Master record.';
  end if;
end
$$;

insert into zigo.service_category_masters (
  pillar_id,
  code,
  name,
  description,
  display_order,
  status,
  is_active,
  is_deleted,
  deleted_by,
  deleted_at
)
select
  pillar.id,
  seed.category_code,
  seed.category_name,
  seed.category_description,
  seed.category_order,
  'active'::zigo.lifecycle_status,
  true,
  false,
  null,
  null
from zigo_home_service_category_seed seed
join zigo.service_pillars pillar on pillar.code = 'HOME'
on conflict (code) do update
set pillar_id = excluded.pillar_id,
    name = excluded.name,
    description = excluded.description,
    display_order = excluded.display_order,
    status = excluded.status,
    is_active = excluded.is_active,
    is_deleted = false,
    deleted_by = null,
    deleted_at = null,
    updated_at = now();

insert into zigo.service_category_pillar_mappings (service_category_id, pillar_id, display_order)
select category.id, pillar.id, 1
from zigo_home_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
join zigo.service_pillars pillar on pillar.code = 'HOME'
on conflict (service_category_id, pillar_id) do update
set display_order = excluded.display_order;

insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
select category.id, service.id, mapped.ordinality::int
from zigo_home_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
cross join lateral unnest(seed.service_codes) with ordinality as mapped(service_code, ordinality)
join zigo.services service
  on service.code = mapped.service_code
 and service.is_deleted = false
on conflict (service_category_id, service_id) do update
set display_order = excluded.display_order;
