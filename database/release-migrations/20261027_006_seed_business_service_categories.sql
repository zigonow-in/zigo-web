create temporary table zigo_business_service_category_seed (
  category_code text primary key,
  category_name text not null,
  category_description text not null,
  category_order integer not null,
  service_codes text[] not null
) on commit drop;

insert into zigo_business_service_category_seed (category_code, category_name, category_description, category_order, service_codes)
values
  ('SC_BUSINESS_DELIVERY_DISPATCH', 'Pickups, Deliveries & Couriers', 'Collect and deliver business items, dispatch parcels and handle urgent errands.', 1, array['SVC_ITEM_COLLECTION_DELIVERY', 'SVC_COURIER_SUPPORT', 'SVC_URGENT_ERRANDS']),
  ('SC_BUSINESS_DOCUMENTS_ADMIN', 'Documents & Official Visits', 'Help with paperwork, document submissions, banking, administrative follow-ups and queues.', 2, array['SVC_DOCUMENT_ASSISTANCE', 'SVC_ADMIN_VISITS']),
  ('SC_BUSINESS_OFFICE_EXECUTIVE', 'Office & Executive Assistance', 'Help with office errands, executive tasks and multiple activities throughout the day.', 3, array['SVC_PERSONAL_DAY', 'SVC_CORPORATE_ERRANDS', 'SVC_EXECUTIVE_ASSISTANCE']),
  ('SC_BUSINESS_FIELDWORK_MAINTENANCE', 'Fieldwork & Service Errands', 'Complete field visits, collect samples, coordinate vendors and handle laundry, repair or vehicle service errands.', 4, array['SVC_LAUNDRY_REPAIR', 'SVC_VEHICLE_ERRANDS', 'SVC_BUSINESS_FIELDWORK']),
  ('SC_BUSINESS_TRAVEL_VISITORS', 'Business Travel & Visitors', 'On-ground assistance for business journeys, visiting colleagues, clients and travel-related errands.', 5, array['SVC_LOCAL_TRAVEL', 'SVC_TRAVEL_ERRANDS', 'SVC_VISITOR_SUPPORT']),
  ('SC_BUSINESS_EVENTS_SUPPORT', 'Events & Meetings', 'Help prepare meeting materials, arrange event supplies and provide on-site assistance for office events, conferences and exhibitions.', 6, array['SVC_BUSINESS_EVENT_SUPPORT']);

do $$
begin
  if exists (
    select 1
    from zigo_business_service_category_seed seed
    cross join lateral unnest(seed.service_codes) as required(service_code)
    left join zigo.services service
      on service.code = required.service_code
     and service.is_deleted = false
    where service.id is null
  ) then
    raise exception 'Business Service Category seed references a missing active Service Master record.';
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
from zigo_business_service_category_seed seed
join zigo.service_pillars pillar on pillar.code = 'BUSINESS_NEEDS'
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
from zigo_business_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
join zigo.service_pillars pillar on pillar.code = 'BUSINESS_NEEDS'
on conflict (service_category_id, pillar_id) do update
set display_order = excluded.display_order;

insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
select category.id, service.id, mapped.ordinality::int
from zigo_business_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
cross join lateral unnest(seed.service_codes) with ordinality as mapped(service_code, ordinality)
join zigo.services service
  on service.code = mapped.service_code
 and service.is_deleted = false
on conflict (service_category_id, service_id) do update
set display_order = excluded.display_order;
