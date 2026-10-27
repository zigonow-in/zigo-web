create temporary table zigo_service_category_seed (
  category_code text primary key,
  category_name text not null,
  category_description text not null,
  category_order integer not null,
  service_codes text[] not null
) on commit drop;

insert into zigo_service_category_seed (category_code, category_name, category_description, category_order, service_codes)
values
  ('SC_SHOPPING_ERRANDS', 'Shopping & Errands', 'Help with shopping, pickups, deliveries, laundry, repairs and urgent errands.', 1, array['SVC_SHOPPING_ERRANDS', 'SVC_ITEM_COLLECTION_DELIVERY', 'SVC_LAUNDRY_REPAIR', 'SVC_COURIER_SUPPORT', 'SVC_URGENT_ERRANDS', 'SVC_VEHICLE_ERRANDS']),
  ('SC_DOCUMENTS_VISITS', 'Documents & Official Visits', 'Help with documents, paperwork, submissions, banking, administrative visits and queues.', 2, array['SVC_DOCUMENT_ASSISTANCE', 'SVC_ADMIN_VISITS']),
  ('SC_OUTINGS_TRAVEL', 'Outings & Travel', 'Accompaniment, companionship and practical assistance for outings, local journeys and travel.', 3, array['SVC_PERSONAL_ACCOMPANIMENT', 'SVC_COMPANIONSHIP', 'SVC_AIRPORT_ASSISTANCE', 'SVC_LOCAL_TRAVEL', 'SVC_TRAVEL_ERRANDS', 'SVC_VISITOR_SUPPORT']),
  ('SC_FAMILY_CARE', 'Family & Care', 'Non-medical assistance for elders, hospital visits, appointments and everyday family needs.', 4, array['SVC_ELDER_ASSISTANCE', 'SVC_HOSPITAL_ASSISTANCE', 'SVC_FAMILY_ERRANDS']),
  ('SC_HOME_OCCASIONS', 'Home & Occasions', 'Help with home organisation, moving, household coordination, guests and celebrations.', 5, array['SVC_FAMILY_OCCASIONS', 'SVC_HOME_ORGANISATION', 'SVC_HOME_GUEST_SUPPORT', 'SVC_HOUSEHOLD_COORDINATION', 'SVC_MOVING_HOME_SETUP']),
  ('SC_WORK_DAY_ASSISTANCE', 'Work & Day Assistance', 'Help with office tasks, business errands, events and multiple tasks throughout the day.', 6, array['SVC_PERSONAL_DAY', 'SVC_CORPORATE_ERRANDS', 'SVC_EXECUTIVE_ASSISTANCE', 'SVC_BUSINESS_EVENT_SUPPORT']);

do $$
begin
  if exists (
    select 1
    from zigo_service_category_seed seed
    cross join lateral unnest(seed.service_codes) as required(service_code)
    left join zigo.services service
      on service.code = required.service_code
     and service.is_deleted = false
    where service.id is null
  ) then
    raise exception 'Service Category seed references a missing active Service Master record.';
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
from zigo_service_category_seed seed
join zigo.service_pillars pillar on pillar.code = 'PERSONAL'
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
from zigo_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
join zigo.service_pillars pillar on pillar.code = 'PERSONAL'
on conflict (service_category_id, pillar_id) do update
set display_order = excluded.display_order;

insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
select category.id, service.id, mapped.ordinality::int
from zigo_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
cross join lateral unnest(seed.service_codes) with ordinality as mapped(service_code, ordinality)
join zigo.services service
  on service.code = mapped.service_code
 and service.is_deleted = false
on conflict (service_category_id, service_id) do update
set display_order = excluded.display_order;
