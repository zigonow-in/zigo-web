create temporary table zigo_family_service_category_seed (
  category_code text primary key,
  category_name text not null,
  category_description text not null,
  category_order integer not null,
  service_codes text[] not null
) on commit drop;

insert into zigo_family_service_category_seed (category_code, category_name, category_description, category_order, service_codes)
values
  ('SC_FAMILY_DAILY_SUPPORT', 'Everyday Family Help', 'Help with family shopping, pickups, deliveries, urgent errands and multiple daily tasks.', 1, array['SVC_SHOPPING_ERRANDS', 'SVC_ITEM_COLLECTION_DELIVERY', 'SVC_PERSONAL_DAY', 'SVC_URGENT_ERRANDS', 'SVC_FAMILY_ERRANDS']),
  ('SC_FAMILY_ELDER_COMPANIONSHIP', 'Parents & Companionship', 'Practical assistance for elderly family members, companionship and participation in social activities.', 2, array['SVC_COMPANIONSHIP', 'SVC_ELDER_ASSISTANCE']),
  ('SC_FAMILY_HOSPITAL_APPOINTMENTS', 'Hospital & Appointment Help', 'Non-medical assistance with hospital visits, registration, navigation, waiting and appointments.', 3, array['SVC_HOSPITAL_ASSISTANCE']),
  ('SC_FAMILY_SCHOOL_PAPERWORK', 'School & Paperwork', 'Help with school errands, documents, banking and administrative visits for your family.', 4, array['SVC_DOCUMENT_ASSISTANCE', 'SVC_ADMIN_VISITS', 'SVC_SCHOOL_ERRANDS']),
  ('SC_FAMILY_OUTINGS_TRAVEL', 'Outings & Travel', 'Accompany family members on outings and help with local journeys, airports and railway or bus stations.', 5, array['SVC_PERSONAL_ACCOMPANIMENT', 'SVC_AIRPORT_ASSISTANCE', 'SVC_STATION_ASSISTANCE', 'SVC_LOCAL_TRAVEL']),
  ('SC_FAMILY_HOME_OCCASIONS', 'Home & Family Occasions', 'Help with guests, celebrations, household coordination, moving and settling into a home.', 6, array['SVC_FAMILY_OCCASIONS', 'SVC_HOME_GUEST_SUPPORT', 'SVC_HOUSEHOLD_COORDINATION', 'SVC_MOVING_HOME_SETUP']);

do $$
begin
  if exists (
    select 1
    from zigo_family_service_category_seed seed
    cross join lateral unnest(seed.service_codes) as required(service_code)
    left join zigo.services service
      on service.code = required.service_code
     and service.is_deleted = false
    where service.id is null
  ) then
    raise exception 'Family Service Category seed references a missing active Service Master record.';
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
from zigo_family_service_category_seed seed
join zigo.service_pillars pillar on pillar.code = 'FAMILY'
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
from zigo_family_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
join zigo.service_pillars pillar on pillar.code = 'FAMILY'
on conflict (service_category_id, pillar_id) do update
set display_order = excluded.display_order;

insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
select category.id, service.id, mapped.ordinality::int
from zigo_family_service_category_seed seed
join zigo.service_category_masters category on category.code = seed.category_code
cross join lateral unnest(seed.service_codes) with ordinality as mapped(service_code, ordinality)
join zigo.services service
  on service.code = mapped.service_code
 and service.is_deleted = false
on conflict (service_category_id, service_id) do update
set display_order = excluded.display_order;
