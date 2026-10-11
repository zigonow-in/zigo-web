create index concurrently if not exists idx_service_requests_created_at
  on zigo.service_requests (created_at desc);
