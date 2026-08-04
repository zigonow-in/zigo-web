alter table zigo.booking_engine_rules
  add column if not exists instant_initiate_minutes integer not null default 0,
  add column if not exists schedule_initiate_minutes integer not null default 0;

alter table zigo.service_requests
  add column if not exists initiate_minutes integer not null default 0;
