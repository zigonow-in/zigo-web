-- Dashboard analytics indexes: support bounded trend and customer aggregation queries.
create index if not exists idx_service_requests_created_at
  on zigo.service_requests (created_at desc);

create index if not exists idx_service_requests_customer_created_at
  on zigo.service_requests (customer_id, created_at desc);

create index if not exists idx_service_requests_paid_created_at
  on zigo.service_requests (created_at desc, customer_id)
  where is_paid = true;
