create index concurrently if not exists idx_assistant_location_pings_booking_captured
  on zigo.assistant_location_pings (service_request_id, captured_at desc, created_at desc);
