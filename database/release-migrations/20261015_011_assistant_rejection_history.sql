do $migration$
begin
  if to_regclass('zigo.service_requests') is null
    or to_regclass('zigo.task_assignments') is null
    or to_regclass('zigo.assistant_capacity_reservations') is null
    or to_regclass('zigo.booking_orchestration_state') is null then
    raise exception 'Required booking schema is missing. Apply the existing booking migrations first.';
  end if;
end
$migration$;

update zigo.task_assignments ta
set metadata = coalesce(ta.metadata, '{}'::jsonb) || jsonb_build_object(
      'assistantRejectedCopy', true,
      'rejectedAt', coalesce(ta.responded_at, ta.offered_at, now()),
      'rejectedAssignmentId', ta.id::text,
      'rejectedAssistantId', ta.assistant_id::text,
      'rejectionSource', coalesce(nullif(ta.metadata->>'rejectionSource', ''), 'legacy_assistant_rejection')
    )
from zigo.service_requests sr
where sr.id = coalesce(ta.service_request_id, ta.request_id)
  and lower(coalesce(sr.status_code, '')) = 'rejected'
  and sr.accepted_assignment_id is null
  and sr.actual_task_started_at is null
  and sr.completed_at is null
  and nullif(sr.cancelled_reason, '') is null
  and lower(coalesce(ta.status_code, '')) in ('rejected', 'declined', 'not_accepted');

with legacy_rejections as (
  select distinct on (sr.id)
    sr.id as booking_id,
    ta.id as assignment_id,
    ta.assistant_id,
    coalesce(ta.responded_at, ta.offered_at, sr.updated_at, now()) as rejected_at
  from zigo.service_requests sr
  join zigo.task_assignments ta
    on sr.id = coalesce(ta.service_request_id, ta.request_id)
  where lower(coalesce(sr.status_code, '')) = 'rejected'
    and sr.accepted_assignment_id is null
    and sr.actual_task_started_at is null
    and sr.completed_at is null
    and nullif(sr.cancelled_reason, '') is null
    and lower(coalesce(ta.status_code, '')) in ('rejected', 'declined', 'not_accepted')
  order by sr.id, coalesce(ta.responded_at, ta.offered_at) desc nulls last
), repaired as (
  update zigo.service_requests sr
  set status_code = 'queued',
      metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object(
        'pendingAssignmentId', null,
        'lastRejectedAssignmentId', legacy_rejections.assignment_id::text,
        'lastRejectedAssistantId', legacy_rejections.assistant_id::text,
        'lastAssistantRejectedAt', legacy_rejections.rejected_at,
        'assistantRejectionHistoryMigratedAt', now()
      ),
      updated_at = now()
  from legacy_rejections
  where sr.id = legacy_rejections.booking_id
  returning sr.id
)
update zigo.booking_orchestration_state os
set demand_status = 'queued',
    supply_status = 'unassigned',
    assistant_id = null,
    reservation_id = null,
    risk_status = case when os.risk_status = 'closed' then 'needs_manual_action' else os.risk_status end,
    next_check_at = now(),
    last_event_type = 'assistant.rejection_history_migrated',
    metadata = coalesce(os.metadata, '{}'::jsonb) || jsonb_build_object('assistantRejectionHistoryMigratedAt', now()),
    updated_at = now()
from repaired
where os.service_request_id = repaired.id;

update zigo.assistant_capacity_reservations acr
set status_code = 'released',
    released_at = coalesce(acr.released_at, now()),
    release_reason = coalesce(acr.release_reason, 'Assistant rejected booking'),
    updated_at = now(),
    metadata = coalesce(acr.metadata, '{}'::jsonb) || jsonb_build_object('releaseReasonCode', 'assistant_rejected_booking')
from zigo.task_assignments ta
join zigo.service_requests sr
  on sr.id = coalesce(ta.service_request_id, ta.request_id)
where acr.assignment_id = ta.id
  and sr.metadata ? 'assistantRejectionHistoryMigratedAt'
  and lower(coalesce(ta.status_code, '')) in ('rejected', 'declined', 'not_accepted')
  and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active');
