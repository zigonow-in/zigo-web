create index concurrently if not exists idx_service_requests_customer_created_at
  on zigo.service_requests (customer_id, created_at desc);
