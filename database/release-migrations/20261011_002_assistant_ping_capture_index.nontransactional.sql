create index concurrently if not exists idx_assistant_location_pings_assistant_captured
  on zigo.assistant_location_pings (assistant_id, captured_at desc, created_at desc);
