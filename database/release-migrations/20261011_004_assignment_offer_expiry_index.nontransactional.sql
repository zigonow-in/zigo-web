create index concurrently if not exists idx_admin_assignment_offer_expiry
  on zigo.task_assignments (expires_at)
  where status_code = 'offered' and metadata->>'adminOffer' = 'true';
