create temporary table zigo_travel_service_category_seed (
  category_code text primary key,
  category_name text not null,
  category_description text not null,
  category_order integer not null,
  service_codes text[] not null
) on commit drop;

insert into zigo_travel_service_category_seed (category_code, category_name, category_description, category_order, service_codes)
values
  ('SC_TRAVEL_AIRPORT_STATION', 'Airport & Station Help', 'Assistance with airport, railway and bus station visits, luggage, navigation and accompaniment.', 1, array['SVC_AIRPORT_ASSISTANCE', 'SVC_STATION_ASSISTANCE']),
  ('SC_TRAVEL_ACCOMPANIMENT', 'Travel & Outing Companionship', 'Accompany customers on local journeys, appointments, outings and social activities.', 2, array['SVC_PERSONAL_ACCOMPANIMENT', 'SVC_COMPANIONSHIP', 'SVC_LOCAL_TRAVEL']),
  ('SC_TRAVEL_SHOPPING_DELIVERY', 'Travel Shopping & Errands', 'Help with travel essentials, shopping, forgotten items, collections, deliveries and urgent errands.', 3, array['SVC_SHOPPING_ERRANDS', 'SVC_ITEM_COLLECTION_DELIVERY', 'SVC_URGENT_ERRANDS', 'SVC_TRAVEL_ERRANDS']),
  ('SC_TRAVEL_VISITOR_DAY_SUPPORT', 'Visitor & Day Assistance', 'On-ground help for visitors, first-time travellers and customers needing assistance across multiple stops or tasks.', 4, array['SVC_PERSONAL_DAY', 'SVC_VISITOR_SUPPORT']),
  ('SC_TRAVEL_DOCUMENTS_VEHICLE', 'Documents & Vehicle Errands', 'Help collecting or submitting travel documents and dropping off or collecting vehicles for servicing.', 5, array['SVC_DOCUMENT_ASSISTANCE', 'SVC_VEHICLE_ERRANDS']);

do $$
begin
  if exists (
    select 1
    from zigo_travel_service_category_seed seed
    cross join lateral unnest(seed.service_codes) as required(service_code)
    left join zigo.services service
      on service.code = required.service_code
     and service.is_deleted = false
    where service.id is null
  ) then
    raise exception 'Travel Service Category seed references a missing active Service Master record.';
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
from zigo_travel_service_category_seed seed
join zigo.service_pillars pillar on pillar.code = 'TRAVEL'
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
from zigo_travel_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
join zigo.service_pillars pillar on pillar.code = 'TRAVEL'
on conflict (service_category_id, pillar_id) do update
set display_order = excluded.display_order;

insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
select category.id, service.id, mapped.ordinality::int
from zigo_travel_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
cross join lateral unnest(seed.service_codes) with ordinality as mapped(service_code, ordinality)
join zigo.services service
  on service.code = mapped.service_code
 and service.is_deleted = false
on conflict (service_category_id, service_id) do update
set display_order = excluded.display_order;
