create index concurrently if not exists idx_service_requests_paid_created_at
  on zigo.service_requests (created_at desc, customer_id)
  where is_paid = true;
