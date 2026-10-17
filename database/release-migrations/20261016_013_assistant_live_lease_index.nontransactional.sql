create index concurrently if not exists idx_assistant_availability_live_lease
  on zigo.assistant_availability (presence_status, heartbeat_at desc, gps_captured_at desc, assistant_id)
  where lower(status_code) in ('available', 'online', 'active', 'working');
