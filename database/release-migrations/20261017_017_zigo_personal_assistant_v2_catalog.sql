insert into zigo.service_pillars (code, name, description, display_order, status)
values
  ('PERSONAL_LIFE', 'Personal Life', 'Everyday errands, shopping, personal tasks, appointments and companionship.', 1, 'active'),
  ('FAMILY', 'Family', 'Elder assistance, hospital accompaniment, family errands and agreed support for dependants.', 2, 'active'),
  ('TRAVEL', 'Travel', 'Airport, railway station, local journeys, traveller accompaniment and travel-related tasks.', 3, 'active'),
  ('HOME', 'Home', 'Household organisation, guest preparation, deliveries, moving and vendor coordination.', 4, 'active'),
  ('BUSINESS_NEEDS', 'Business Needs', 'Corporate errands, documents, office tasks, fieldwork and executive assistance.', 5, 'active')
on conflict (code) do nothing;

insert into zigo.booking_modes (code, name, included_minutes, settings, status)
values
  ('TASK', 'Specific Task', null, '{"allowsMultipleTasks": false, "billingModel": "task"}'::jsonb, 'active'),
  ('MULTI_TASK', 'Multiple Tasks', null, '{"allowsMultipleTasks": true, "billingModel": "task"}'::jsonb, 'active'),
  ('ASSISTANT_3H', 'Assistant for 3 Hours', 180, '{"allowsMultipleTasks": true, "billingModel": "time"}'::jsonb, 'active'),
  ('ASSISTANT_6H', 'Assistant for 6 Hours', 360, '{"allowsMultipleTasks": true, "billingModel": "time"}'::jsonb, 'active'),
  ('ASSISTANT_8H', 'Assistant for 8 Hours', 480, '{"allowsMultipleTasks": true, "billingModel": "time"}'::jsonb, 'active')
on conflict (code) do nothing;

with service_seed (code, pillar_code, service_order, name, description, booking_mode) as (
  values
    ('PL_SHOPPING_ERRANDS', 'PERSONAL_LIFE', 1, 'Shopping & Personal Errands', 'Shopping, pickup, returns, collections and personal purchases.', 'task'),
    ('PL_PERSONAL_ADMIN', 'PERSONAL_LIFE', 2, 'Personal Administration', 'Bank, post-office, document, printing, courier and appointment administration.', 'task'),
    ('PL_DAY_ASSISTANCE', 'PERSONAL_LIFE', 3, 'Personal Day Assistance', 'Multiple errands, outings and dedicated assistance for an agreed period.', 'assistant_hours'),
    ('PL_COMPANIONSHIP', 'PERSONAL_LIFE', 4, 'Companionship & Social Support', 'Non-clinical accompaniment, conversation and agreed social activities.', 'task'),
    ('PL_URGENT_TASKS', 'PERSONAL_LIFE', 5, 'Urgent Personal Tasks', 'Eligible time-sensitive pickups, purchases, deliveries and errands.', 'task'),
    ('FA_ELDER_ASSISTANCE', 'FAMILY', 1, 'Elder Assistance', 'Non-clinical accompaniment, errands, navigation and routine paperwork for elders.', 'task'),
    ('FA_HOSPITAL_APPOINTMENT', 'FAMILY', 2, 'Hospital & Appointment Assistance', 'Non-clinical appointment accompaniment, reports, pharmacy collection and transport coordination.', 'task'),
    ('FA_FAMILY_ERRANDS', 'FAMILY', 3, 'Family Errands & Support', 'Approved family shopping, deliveries, administration and routine coordination.', 'task'),
    ('FA_CHILD_ERRANDS', 'FAMILY', 4, 'Child-Related Errands', 'Approved child-related errands subject to formal safeguarding controls.', 'task'),
    ('FA_FAMILY_OCCASIONS', 'FAMILY', 5, 'Family Occasions', 'Supplies, shopping, guest assistance and errands for family occasions.', 'task'),
    ('TR_AIRPORT_ASSISTANCE', 'TRAVEL', 1, 'Airport Assistance', 'Permitted public-area accompaniment, luggage help and travel coordination.', 'task'),
    ('TR_STATION_ASSISTANCE', 'TRAVEL', 2, 'Railway & Bus Station Assistance', 'Station accompaniment, permitted luggage help and onward travel coordination.', 'task'),
    ('TR_LOCAL_TRAVEL', 'TRAVEL', 3, 'Local Travel Assistance', 'Local accompaniment, multi-stop errands and approved vehicle coordination.', 'task'),
    ('TR_TRAVEL_ERRANDS', 'TRAVEL', 4, 'Travel Errands', 'Collection, purchase and delivery of authorised travel items.', 'task'),
    ('TR_VISITOR_SUPPORT', 'TRAVEL', 5, 'Traveller & Visitor Support', 'Practical local support and accompaniment for travellers and visitors.', 'task'),
    ('HO_HOME_ORGANISATION', 'HOME', 1, 'Home Organisation', 'Organising, packing, unpacking, sorting and preparing household spaces.', 'task'),
    ('HO_GUEST_GATHERING', 'HOME', 2, 'Guest & Gathering Assistance', 'Preparation, supplies, serving support and household errands for gatherings.', 'task'),
    ('HO_HOUSEHOLD_COORDINATION', 'HOME', 3, 'Household Coordination', 'Deliveries, authorised vendors, service visits and household checklists.', 'task'),
    ('HO_MOVING_SETUP', 'HOME', 4, 'Moving & Home Setup', 'Packing, keys, moving supplies, arranging belongings and setup errands.', 'task'),
    ('HO_HOME_ERRANDS', 'HOME', 5, 'Home Errands & Everyday Help', 'Household collections, coordination, deliveries and small agreed home tasks.', 'task'),
    ('BU_CORPORATE_ERRANDS', 'BUSINESS_NEEDS', 1, 'Corporate Errands', 'Authorised documents, printing, procurement, courier and office errands.', 'task'),
    ('BU_EXECUTIVE_ASSISTANCE', 'BUSINESS_NEEDS', 2, 'Executive Personal Assistance', 'Personal errands, meeting preparation and authorised coordination for executives.', 'task'),
    ('BU_BANK_ADMIN', 'BUSINESS_NEEDS', 3, 'Banking & Administrative Visits', 'Authorised paperwork, visits, queues, delivery and routine follow-ups.', 'task'),
    ('BU_FIELD_OPERATIONS', 'BUSINESS_NEEDS', 4, 'Fieldwork & Business Operations', 'Market visits, deliveries, site evidence, checklists and vendor coordination.', 'task'),
    ('BU_EVENTS_OFFICE', 'BUSINESS_NEEDS', 5, 'Events & Office Support', 'Event preparation, materials, approved on-site tasks and urgent business deliveries.', 'task')
)
insert into zigo.services (
  code,
  name,
  description,
  sort_order,
  is_active,
  is_enabled,
  default_booking_mode,
  status,
  metadata
)
select
  service_seed.code,
  service_seed.name,
  service_seed.description,
  1000 + (pillar.display_order * 100) + service_seed.service_order,
  false,
  false,
  service_seed.booking_mode,
  'draft'::zigo.lifecycle_status,
  jsonb_build_object(
    'catalogSource', 'zigo_personal_assistant_v2',
    'pillarCode', service_seed.pillar_code,
    'serviceGroupOrder', service_seed.service_order,
    'requiresApproval', true
  )
from service_seed
join zigo.service_pillars pillar on pillar.code = service_seed.pillar_code
on conflict (code) do nothing;

with service_seed (service_code, pillar_code, is_primary) as (
  values
    ('PL_SHOPPING_ERRANDS', 'PERSONAL_LIFE', true),
    ('PL_PERSONAL_ADMIN', 'PERSONAL_LIFE', true),
    ('PL_DAY_ASSISTANCE', 'PERSONAL_LIFE', true),
    ('PL_COMPANIONSHIP', 'PERSONAL_LIFE', true),
    ('PL_URGENT_TASKS', 'PERSONAL_LIFE', true),
    ('FA_ELDER_ASSISTANCE', 'FAMILY', true),
    ('FA_HOSPITAL_APPOINTMENT', 'FAMILY', true),
    ('FA_FAMILY_ERRANDS', 'FAMILY', true),
    ('FA_CHILD_ERRANDS', 'FAMILY', true),
    ('FA_FAMILY_OCCASIONS', 'FAMILY', true),
    ('TR_AIRPORT_ASSISTANCE', 'TRAVEL', true),
    ('TR_STATION_ASSISTANCE', 'TRAVEL', true),
    ('TR_LOCAL_TRAVEL', 'TRAVEL', true),
    ('TR_TRAVEL_ERRANDS', 'TRAVEL', true),
    ('TR_VISITOR_SUPPORT', 'TRAVEL', true),
    ('HO_HOME_ORGANISATION', 'HOME', true),
    ('HO_GUEST_GATHERING', 'HOME', true),
    ('HO_HOUSEHOLD_COORDINATION', 'HOME', true),
    ('HO_MOVING_SETUP', 'HOME', true),
    ('HO_HOME_ERRANDS', 'HOME', true),
    ('BU_CORPORATE_ERRANDS', 'BUSINESS_NEEDS', true),
    ('BU_EXECUTIVE_ASSISTANCE', 'BUSINESS_NEEDS', true),
    ('BU_BANK_ADMIN', 'BUSINESS_NEEDS', true),
    ('BU_FIELD_OPERATIONS', 'BUSINESS_NEEDS', true),
    ('BU_EVENTS_OFFICE', 'BUSINESS_NEEDS', true)
)
insert into zigo.service_pillar_mappings (service_id, pillar_id, is_primary)
select service.id, pillar.id, service_seed.is_primary
from service_seed
join zigo.services service on service.code = service_seed.service_code
join zigo.service_pillars pillar on pillar.code = service_seed.pillar_code
on conflict (service_id, pillar_id) do nothing;

create temporary table zigo_v2_seed_tasks (
  service_code text not null,
  task_order integer not null,
  task_name text not null,
  primary key (service_code, task_order)
) on commit drop;

insert into zigo_v2_seed_tasks (service_code, task_order, task_name)
values
  ('PL_SHOPPING_ERRANDS', 1, 'Grocery, food and essentials pickup'),
  ('PL_SHOPPING_ERRANDS', 2, 'Shopping from malls, markets and local stores'),
  ('PL_SHOPPING_ERRANDS', 3, 'Product returns, exchanges and repairs'),
  ('PL_SHOPPING_ERRANDS', 4, 'Dry cleaning, laundry and parcel collection'),
  ('PL_SHOPPING_ERRANDS', 5, 'Gifts, flowers and personal purchases'),
  ('PL_PERSONAL_ADMIN', 1, 'Bank and post-office visits'),
  ('PL_PERSONAL_ADMIN', 2, 'Document collection and authorised submission'),
  ('PL_PERSONAL_ADMIN', 3, 'Printing, photocopying and courier errands'),
  ('PL_PERSONAL_ADMIN', 4, 'Appointment-related tasks and paperwork'),
  ('PL_PERSONAL_ADMIN', 5, 'Queue assistance where permitted'),
  ('PL_DAY_ASSISTANCE', 1, 'Managing multiple errands in one booking'),
  ('PL_DAY_ASSISTANCE', 2, 'Accompanying a customer to appointments or planned outings'),
  ('PL_DAY_ASSISTANCE', 3, 'Helping with a busy day''s task list'),
  ('PL_DAY_ASSISTANCE', 4, 'Shopping and preparation before meetings or occasions'),
  ('PL_DAY_ASSISTANCE', 5, 'Dedicated assistance for three, six or eight hours'),
  ('PL_COMPANIONSHIP', 1, 'Accompanying someone to a cafe, park or social outing'),
  ('PL_COMPANIONSHIP', 2, 'Attending an event with a customer when agreed'),
  ('PL_COMPANIONSHIP', 3, 'Accompanying a customer to appointments'),
  ('PL_COMPANIONSHIP', 4, 'Providing friendly conversation during an agreed activity'),
  ('PL_COMPANIONSHIP', 5, 'Helping someone participate in everyday activities when they do not want to go alone'),
  ('PL_URGENT_TASKS', 1, 'Forgotten keys, documents or essentials'),
  ('PL_URGENT_TASKS', 2, 'Last-minute purchases and pickups'),
  ('PL_URGENT_TASKS', 3, 'Urgent item delivery'),
  ('PL_URGENT_TASKS', 4, 'Time-sensitive errands before meetings or events'),
  ('FA_ELDER_ASSISTANCE', 1, 'Accompanying elders to hospitals, clinics, banks and temples'),
  ('FA_ELDER_ASSISTANCE', 2, 'Helping with agreed shopping and errands'),
  ('FA_ELDER_ASSISTANCE', 3, 'Accompanying elders on walks or social outings'),
  ('FA_ELDER_ASSISTANCE', 4, 'Assisting with navigation and routine paperwork'),
  ('FA_ELDER_ASSISTANCE', 5, 'Updating authorised family members on task progress'),
  ('FA_HOSPITAL_APPOINTMENT', 1, 'Accompanying patients to appointments'),
  ('FA_HOSPITAL_APPOINTMENT', 2, 'Helping with registration and directions'),
  ('FA_HOSPITAL_APPOINTMENT', 3, 'Collecting reports and authorised documents'),
  ('FA_HOSPITAL_APPOINTMENT', 4, 'Pharmacy and essential-item collection'),
  ('FA_HOSPITAL_APPOINTMENT', 5, 'Waiting with a patient during an appointment'),
  ('FA_HOSPITAL_APPOINTMENT', 6, 'Coordinating transport to and from appointments'),
  ('FA_FAMILY_ERRANDS', 1, 'Collecting groceries and essential supplies'),
  ('FA_FAMILY_ERRANDS', 2, 'Handling family shopping and deliveries'),
  ('FA_FAMILY_ERRANDS', 3, 'Completing errands when family members are at work'),
  ('FA_FAMILY_ERRANDS', 4, 'Helping relatives with approved administrative tasks'),
  ('FA_FAMILY_ERRANDS', 5, 'Coordinating routine appointments and collections'),
  ('FA_CHILD_ERRANDS', 1, 'Collecting school supplies and documents'),
  ('FA_CHILD_ERRANDS', 2, 'Delivering forgotten items to an authorised location'),
  ('FA_CHILD_ERRANDS', 3, 'Assisting with approved school-related errands'),
  ('FA_CHILD_ERRANDS', 4, 'Pre-arranged accompaniment or pickup under a formal safeguarding process'),
  ('FA_FAMILY_OCCASIONS', 1, 'Preparing supplies for family gatherings'),
  ('FA_FAMILY_OCCASIONS', 2, 'Shopping for birthdays and celebrations'),
  ('FA_FAMILY_OCCASIONS', 3, 'Guest assistance and event-day errands'),
  ('FA_FAMILY_OCCASIONS', 4, 'Helping with planned family outings'),
  ('TR_AIRPORT_ASSISTANCE', 1, 'Accompanying travellers in permitted public areas'),
  ('TR_AIRPORT_ASSISTANCE', 2, 'Assistance with navigation and luggage in permitted areas'),
  ('TR_AIRPORT_ASSISTANCE', 3, 'Forgotten travel-essential collection or delivery'),
  ('TR_AIRPORT_ASSISTANCE', 4, 'Help coordinating pickup and drop-off'),
  ('TR_AIRPORT_ASSISTANCE', 5, 'Accompanying elderly or first-time travellers'),
  ('TR_STATION_ASSISTANCE', 1, 'Station navigation and accompaniment'),
  ('TR_STATION_ASSISTANCE', 2, 'Assistance with luggage in permitted areas'),
  ('TR_STATION_ASSISTANCE', 3, 'Helping elderly travellers reach the appropriate waiting area'),
  ('TR_STATION_ASSISTANCE', 4, 'Essential-item pickup and delivery'),
  ('TR_STATION_ASSISTANCE', 5, 'Coordinating onward transport'),
  ('TR_LOCAL_TRAVEL', 1, 'Accompanying a customer to appointments or meetings'),
  ('TR_LOCAL_TRAVEL', 2, 'Helping with multi-stop city errands'),
  ('TR_LOCAL_TRAVEL', 3, 'Coordinating approved vehicle servicing and collection'),
  ('TR_LOCAL_TRAVEL', 4, 'Helping organise belongings for a local journey'),
  ('TR_TRAVEL_ERRANDS', 1, 'Collecting forgotten documents or belongings'),
  ('TR_TRAVEL_ERRANDS', 2, 'Purchasing permitted travel essentials'),
  ('TR_TRAVEL_ERRANDS', 3, 'Collecting luggage or personal items where authorised'),
  ('TR_TRAVEL_ERRANDS', 4, 'Delivering items to a hotel, home or office'),
  ('TR_VISITOR_SUPPORT', 1, 'Accompanying visitors around a city'),
  ('TR_VISITOR_SUPPORT', 2, 'Helping with practical local errands'),
  ('TR_VISITOR_SUPPORT', 3, 'Accompanying a customer to a pre-arranged activity'),
  ('TR_VISITOR_SUPPORT', 4, 'Assisting travellers who prefer not to navigate alone'),
  ('HO_HOME_ORGANISATION', 1, 'Organising rooms, cupboards and household belongings'),
  ('HO_HOME_ORGANISATION', 2, 'Packing and unpacking'),
  ('HO_HOME_ORGANISATION', 3, 'Sorting items and preparing spaces'),
  ('HO_HOME_ORGANISATION', 4, 'Helping prepare a home before or after a move'),
  ('HO_GUEST_GATHERING', 1, 'Preparing supplies before guests arrive'),
  ('HO_GUEST_GATHERING', 2, 'Setting out items and organising agreed spaces'),
  ('HO_GUEST_GATHERING', 3, 'Helping serve guests at a gathering'),
  ('HO_GUEST_GATHERING', 4, 'Shopping for party essentials'),
  ('HO_GUEST_GATHERING', 5, 'Managing last-minute household errands'),
  ('HO_HOUSEHOLD_COORDINATION', 1, 'Receiving deliveries'),
  ('HO_HOUSEHOLD_COORDINATION', 2, 'Coordinating authorised vendors'),
  ('HO_HOUSEHOLD_COORDINATION', 3, 'Being present for scheduled service visits'),
  ('HO_HOUSEHOLD_COORDINATION', 4, 'Helping with agreed home checklists'),
  ('HO_HOUSEHOLD_COORDINATION', 5, 'Coordinating household purchases and collections'),
  ('HO_MOVING_SETUP', 1, 'Packing and unpacking assistance'),
  ('HO_MOVING_SETUP', 2, 'Collecting keys and authorised items'),
  ('HO_MOVING_SETUP', 3, 'Coordinating moving supplies'),
  ('HO_MOVING_SETUP', 4, 'Helping arrange belongings at a new home'),
  ('HO_MOVING_SETUP', 5, 'Completing setup errands after relocation'),
  ('HO_HOME_ERRANDS', 1, 'Grocery and household-item collection'),
  ('HO_HOME_ERRANDS', 2, 'Laundry and parcel coordination'),
  ('HO_HOME_ERRANDS', 3, 'Delivering forgotten items'),
  ('HO_HOME_ERRANDS', 4, 'Helping complete a list of small home tasks'),
  ('BU_CORPORATE_ERRANDS', 1, 'Document pickup, delivery and authorised submission'),
  ('BU_CORPORATE_ERRANDS', 2, 'Printing, photocopying and file preparation'),
  ('BU_CORPORATE_ERRANDS', 3, 'Office supplies and procurement'),
  ('BU_CORPORATE_ERRANDS', 4, 'Courier and parcel handling'),
  ('BU_CORPORATE_ERRANDS', 5, 'Multiple office-related errands'),
  ('BU_EXECUTIVE_ASSISTANCE', 1, 'Personal errands for busy executives'),
  ('BU_EXECUTIVE_ASSISTANCE', 2, 'Collecting clothes, gifts or personal items'),
  ('BU_EXECUTIVE_ASSISTANCE', 3, 'Preparing materials for meetings'),
  ('BU_EXECUTIVE_ASSISTANCE', 4, 'Managing an assigned daily task list'),
  ('BU_EXECUTIVE_ASSISTANCE', 5, 'Coordinating authorised appointments and collections'),
  ('BU_BANK_ADMIN', 1, 'Authorised paperwork collection and submission'),
  ('BU_BANK_ADMIN', 2, 'Appointment-related visits'),
  ('BU_BANK_ADMIN', 3, 'Queue assistance where permitted'),
  ('BU_BANK_ADMIN', 4, 'Delivering signed documents'),
  ('BU_BANK_ADMIN', 5, 'Routine administrative follow-ups'),
  ('BU_FIELD_OPERATIONS', 1, 'Market visits and product sample collection'),
  ('BU_FIELD_OPERATIONS', 2, 'Delivering materials to clients or partners'),
  ('BU_FIELD_OPERATIONS', 3, 'Taking requested site photos'),
  ('BU_FIELD_OPERATIONS', 4, 'Completing standard field checklists'),
  ('BU_FIELD_OPERATIONS', 5, 'Collecting items from suppliers'),
  ('BU_FIELD_OPERATIONS', 6, 'Coordinating approved vendor visits'),
  ('BU_EVENTS_OFFICE', 1, 'Conference and exhibition errands'),
  ('BU_EVENTS_OFFICE', 2, 'Office event preparation'),
  ('BU_EVENTS_OFFICE', 3, 'Guest-material and supply collection'),
  ('BU_EVENTS_OFFICE', 4, 'On-site assistance with approved tasks'),
  ('BU_EVENTS_OFFICE', 5, 'Last-minute business deliveries');

insert into zigo.task_definitions (
  code,
  name,
  task_family,
  risk_tier,
  status,
  metadata
)
select
  seed.service_code || '_' || lpad(seed.task_order::text, 2, '0'),
  seed.task_name,
  seed.service_code,
  case
    when seed.service_code = 'FA_CHILD_ERRANDS' then 'safeguarded'
    when seed.service_code in ('FA_ELDER_ASSISTANCE', 'FA_HOSPITAL_APPOINTMENT', 'PL_COMPANIONSHIP') then 'elevated'
    when seed.service_code in ('PL_PERSONAL_ADMIN', 'BU_CORPORATE_ERRANDS', 'BU_BANK_ADMIN') then 'controlled'
    else 'standard'
  end,
  'draft'::zigo.lifecycle_status,
  jsonb_build_object(
    'catalogSource', 'zigo_personal_assistant_v2',
    'serviceCode', seed.service_code,
    'displayOrder', seed.task_order,
    'requiresApproval', true
  )
from zigo_v2_seed_tasks seed
on conflict (code) do nothing;

insert into zigo.service_task_mappings (service_id, task_id, display_order)
select service.id, task.id, seed.task_order
from zigo_v2_seed_tasks seed
join zigo.services service on service.code = seed.service_code
join zigo.task_definitions task
  on task.code = seed.service_code || '_' || lpad(seed.task_order::text, 2, '0')
on conflict (service_id, task_id) do nothing;

insert into zigo.service_zones (source_zone_id, code, name, active)
select zone.id, zone.code, zone.name, zone.is_active and not zone.is_deleted
from zigo.zones zone
on conflict (code) do nothing;
