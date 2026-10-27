-- Live booking stop additions and extension audit rows.
-- Additive only: existing bookings, payments, and route locations are preserved.

alter table if exists zigo.booking_add_on_payments
  drop constraint if exists booking_add_on_payments_kind_check;

alter table if exists zigo.booking_add_on_payments
  add constraint booking_add_on_payments_kind_check
  check (kind in ('extension', 'tip', 'stop'));

create table if not exists zigo.booking_extension_slots (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  customer_user_id uuid references zigo.users(id) on delete set null,
  sequence_no integer not null default 1,
  previous_duration_minutes integer not null default 0,
  added_duration_minutes integer not null default 0,
  total_duration_minutes integer not null default 0,
  previous_end_at timestamptz,
  extended_end_at timestamptz,
  previous_available_at timestamptz,
  extended_available_at timestamptz,
  amount_paise integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_booking_extension_slots_booking
  on zigo.booking_extension_slots(service_request_id, sequence_no, created_at desc);

create table if not exists zigo.booking_stop_additions (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
  customer_user_id uuid references zigo.users(id) on delete set null,
  request_location_id uuid references zigo.request_locations(id) on delete set null,
  sequence_no integer not null,
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  distance_meters integer not null default 0,
  delivery_amount_paise integer not null default 0,
  extension_minutes integer not null default 0,
  total_amount_paise integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_booking_stop_additions_booking
  on zigo.booking_stop_additions(service_request_id, sequence_no, created_at desc);
