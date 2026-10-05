import { pool } from "../../db/pool.js";
let schemaReadyPromise = null;
export function ensureBookingEngineSchema(client = pool) {
    if (client === pool && schemaReadyPromise)
        return schemaReadyPromise;
    const promise = client.query(`
    create table if not exists zigo.assistant_capacity_reservations (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      assignment_id uuid references zigo.task_assignments(id) on delete set null,
      assistant_id uuid references zigo.assistants(id) on delete set null,
      cluster_id uuid not null references zigo.clusters(id),
      booking_type text not null default 'instant',
      assign_type text not null default 'manual',
      status_code text not null default 'reserved',
      reserved_from timestamptz not null,
      reserved_until timestamptz not null,
      promised_start_at timestamptz,
      sla_deadline_at timestamptz,
      source text not null default 'booking_engine',
      metadata jsonb not null default '{}'::jsonb,
      created_by_user_id uuid references zigo.users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      released_at timestamptz,
      release_reason text
    );
    create index if not exists idx_capacity_reservations_booking on zigo.assistant_capacity_reservations(service_request_id);
    create index if not exists idx_capacity_reservations_assistant_window
      on zigo.assistant_capacity_reservations(assistant_id, reserved_from, reserved_until)
      where status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active');
    create index if not exists idx_capacity_reservations_cluster_window
      on zigo.assistant_capacity_reservations(cluster_id, reserved_from, reserved_until)
      where status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active');
    create index if not exists idx_capacity_reservations_status on zigo.assistant_capacity_reservations(status_code, updated_at desc);

    create table if not exists zigo.booking_orchestration_state (
      service_request_id uuid primary key references zigo.service_requests(id) on delete cascade,
      cluster_id uuid not null references zigo.clusters(id),
      demand_status text not null default 'pending_assign',
      risk_status text not null default 'on_time',
      supply_status text not null default 'unassigned',
      booking_type text not null default 'instant',
      assign_type text not null default 'manual',
      requested_start_at timestamptz,
      promised_start_at timestamptz,
      sla_deadline_at timestamptz,
      assistant_id uuid references zigo.assistants(id) on delete set null,
      reservation_id uuid references zigo.assistant_capacity_reservations(id) on delete set null,
      next_check_at timestamptz,
      last_event_type text,
      metadata jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_booking_orchestration_state_cluster_risk
      on zigo.booking_orchestration_state(cluster_id, risk_status, next_check_at);
    create index if not exists idx_booking_orchestration_state_assistant
      on zigo.booking_orchestration_state(assistant_id);

    create table if not exists zigo.booking_task_updates (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      task_assignment_id uuid references zigo.task_assignments(id) on delete set null,
      actor_user_id uuid references zigo.users(id) on delete set null,
      actor_type text not null,
      update_type text not null default 'text',
      message text,
      media_urls jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_booking_task_updates_request on zigo.booking_task_updates(service_request_id, created_at desc);

    create table if not exists zigo.assistant_delay_credits (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      task_assignment_id uuid not null references zigo.task_assignments(id) on delete cascade,
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      planned_start_at timestamptz,
      actual_started_at timestamptz not null,
      delay_minutes int not null default 0,
      credited_minutes int not null default 0,
      source text not null default 'assistant_start',
      metadata jsonb not null default '{}'::jsonb,
      created_by_user_id uuid references zigo.users(id) on delete set null,
      created_at timestamptz not null default now(),
      unique(task_assignment_id)
    );
    create index if not exists idx_assistant_delay_credits_assistant
      on zigo.assistant_delay_credits(assistant_id, created_at desc);
    create index if not exists idx_assistant_delay_credits_booking
      on zigo.assistant_delay_credits(service_request_id);

    create table if not exists zigo.booking_billing_snapshots (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null unique references zigo.service_requests(id) on delete cascade,
      base_price_paise bigint not null default 0,
      discount_paise bigint not null default 0,
      selling_price_paise bigint not null default 0,
      item_total_paise bigint not null default 0,
      tax_amount_paise bigint not null default 0,
      inclusive_tax_amount_paise bigint not null default 0,
      exclusive_tax_amount_paise bigint not null default 0,
      tip_amount_paise bigint not null default 0,
      waiting_charges_paise bigint not null default 0,
      grand_total_paise bigint not null default 0,
      currency text not null default 'INR',
      tax_details jsonb not null default '[]'::jsonb,
      pricing_details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_booking_billing_snapshots_request
      on zigo.booking_billing_snapshots(service_request_id);

    alter table zigo.service_requests
      add column if not exists booking_at timestamptz not null default now(),
      add column if not exists booking_type text not null default 'instant',
      add column if not exists booking_date date,
      add column if not exists booking_time_slot text,
      add column if not exists booking_amount_paise bigint not null default 0,
      add column if not exists base_price_paise bigint not null default 0,
      add column if not exists discount_paise bigint not null default 0,
      add column if not exists selling_price_paise bigint not null default 0,
      add column if not exists waiting_time_minutes int not null default 0,
      add column if not exists waiting_charges_paise bigint not null default 0,
      add column if not exists payment_type text not null default 'cash',
      add column if not exists payment_status text not null default 'due',
      add column if not exists is_paid boolean not null default false,
      add column if not exists service_details jsonb not null default '{}'::jsonb,
      add column if not exists category_details jsonb not null default '{}'::jsonb,
      add column if not exists store_details jsonb not null default '[]'::jsonb,
      add column if not exists customer_details jsonb not null default '{}'::jsonb,
      add column if not exists payment_details jsonb not null default '{}'::jsonb,
      add column if not exists location_details jsonb not null default '[]'::jsonb,
      add column if not exists upload_details jsonb not null default '[]'::jsonb,
      add column if not exists booking_start_at timestamptz,
      add column if not exists booking_end_at timestamptz,
      add column if not exists booking_available_at timestamptz,
      add column if not exists cluster_id uuid references zigo.clusters(id),
      add column if not exists accepted_assignment_id uuid,
      add column if not exists cancelled_reason text,
      add column if not exists completed_at timestamptz,
      add column if not exists actual_task_started_at timestamptz,
      add column if not exists assistant_start_delay_minutes int not null default 0,
      add column if not exists delay_credit_minutes int not null default 0,
      add column if not exists eta_minutes int not null default 0,
      add column if not exists initiate_minutes int not null default 0,
      add column if not exists wrap_up_minutes int not null default 0,
      add column if not exists travel_buffer_minutes int not null default 0,
      add column if not exists additional_details jsonb not null default '{}'::jsonb;

    alter table zigo.task_assignments
      add column if not exists actual_started_at timestamptz,
      add column if not exists start_delay_minutes int not null default 0,
      add column if not exists delay_credit_minutes int not null default 0;

    do $$
    begin
      if to_regclass('zigo.request_locations') is not null then
        execute 'alter table zigo.request_locations add column if not exists cluster_id uuid references zigo.clusters(id)';

        execute '
          update zigo.request_locations rl
          set cluster_id = sr.cluster_id
          from zigo.service_requests sr
          where rl.service_request_id = sr.id
            and rl.cluster_id is null
            and sr.cluster_id is not null
        ';

        execute 'create index if not exists idx_request_locations_cluster on zigo.request_locations(cluster_id)';
      end if;
    end $$;
  `).then(() => undefined);
    if (client === pool)
        schemaReadyPromise = promise;
    return promise;
}
export async function upsertCapacityReservation(client, input) {
    await ensureBookingEngineSchema(client);
    const result = await client.query(`
      insert into zigo.assistant_capacity_reservations
        (service_request_id, assignment_id, assistant_id, cluster_id, booking_type, assign_type, status_code,
         reserved_from, reserved_until, promised_start_at, sla_deadline_at, source, metadata, created_by_user_id)
       values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text, $8::timestamptz, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::text, $13::jsonb, $14::uuid)
      returning id
    `, [
        input.serviceRequestId,
        input.assignmentId ?? null,
        input.assistantId ?? null,
        input.clusterId,
        input.bookingType,
        input.assignType,
        input.statusCode,
        input.reservedFrom,
        input.reservedUntil,
        input.promisedStartAt ?? null,
        input.slaDeadlineAt ?? null,
        input.source,
        JSON.stringify(input.metadata ?? {}),
        input.actorUserId ?? null
    ]);
    return result.rows[0];
}
export async function releaseCapacityReservations(client, input) {
    await ensureBookingEngineSchema(client);
    await client.query(`
      update zigo.assistant_capacity_reservations
       set status_code = $2::text,
           released_at = now(),
           release_reason = $3::text,
           updated_at = now()
       where service_request_id = $1::uuid
        and status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        and ($4::uuid is null or assignment_id is distinct from $4::uuid)
    `, [input.serviceRequestId, input.statusCode, input.reason, input.exceptAssignmentId ?? null]);
}
export async function upsertBookingOrchestrationState(client, input) {
    await ensureBookingEngineSchema(client);
    await client.query(`
      insert into zigo.booking_orchestration_state
        (service_request_id, cluster_id, demand_status, risk_status, supply_status, booking_type, assign_type,
         requested_start_at, promised_start_at, sla_deadline_at, assistant_id, reservation_id, next_check_at, last_event_type, metadata)
      values ($1, $2, $3, coalesce($4, 'on_time'), coalesce($5, 'unassigned'), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      on conflict (service_request_id)
      do update set
        cluster_id = excluded.cluster_id,
        demand_status = excluded.demand_status,
        risk_status = excluded.risk_status,
        supply_status = excluded.supply_status,
        booking_type = excluded.booking_type,
        assign_type = excluded.assign_type,
        requested_start_at = excluded.requested_start_at,
        promised_start_at = excluded.promised_start_at,
        sla_deadline_at = excluded.sla_deadline_at,
        assistant_id = excluded.assistant_id,
        reservation_id = excluded.reservation_id,
        next_check_at = excluded.next_check_at,
        last_event_type = excluded.last_event_type,
        metadata = excluded.metadata,
        updated_at = now()
    `, [
        input.serviceRequestId,
        input.clusterId,
        input.demandStatus,
        input.riskStatus ?? null,
        input.supplyStatus ?? null,
        input.bookingType,
        input.assignType,
        input.requestedStartAt ?? null,
        input.promisedStartAt ?? null,
        input.slaDeadlineAt ?? null,
        input.assistantId ?? null,
        input.reservationId ?? null,
        input.nextCheckAt ?? null,
        input.lastEventType,
        JSON.stringify(input.metadata ?? {})
    ]);
}
export async function runBookingOrchestrationCycle(client = pool, limit = 100, options = {}) {
    await ensureBookingEngineSchema(client);
    const riskLookaheadMs = Math.max(1, Number(options.riskLookaheadMinutes ?? 15)) * 60_000;
    const steadyCheckMs = Math.max(1, Number(options.slaGraceMinutes ?? 5)) * 60_000;
    const autoCancelDelayMinutes = Math.max(1, Number(options.customerAssistantDelayAutoCancelMinutes ?? 30));
    const autoCancelled = await client.query(`
      with candidates as (
        select
          sr.id as service_request_id,
          sr.cluster_id,
          ta.assistant_id,
          ta.id as assignment_id,
          sr.booking_start_at as planned_start_at,
          coalesce(sr.booking_end_at, sr.booking_start_at + ($1::int || ' minutes')::interval) as expiry_at,
          greatest(0, floor(extract(epoch from (now() - sr.booking_start_at)) / 60))::int as delay_minutes
        from zigo.service_requests sr
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        where sr.booking_start_at is not null
          and coalesce(sr.booking_end_at, sr.booking_start_at + ($1::int || ' minutes')::interval) <= now()
          and lower(coalesce(sr.status_code, '')) in ('confirmed', 'processing', 'assigned', 'accepted', 'queued', 'paid', 'payment_pending', 'hold', 'on_hold')
          and (
            ta.id is null
            or (
              lower(coalesce(ta.status_code, '')) in ('accepted', 'assigned', 'reserved', 'offered')
              and ta.actual_started_at is null
            )
          )
          and sr.actual_task_started_at is null
        order by sr.booking_start_at
        limit $2
        for update of sr skip locked
      ),
      cancelled_assignments as (
        update zigo.task_assignments ta
        set status_code = 'cancelled',
            responded_at = coalesce(ta.responded_at, now()),
            metadata = coalesce(ta.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancelledBy', 'system',
              'cancellationReason', 'Booking slot expired',
              'cancellationReasonCode', 'booking_slot_expired',
              'plannedStartAt', candidates.planned_start_at,
              'expiredAt', candidates.expiry_at,
              'delayMinutes', candidates.delay_minutes,
              'autoCancelDelayMinutes', $1::int,
              'assistantId', candidates.assistant_id,
              'assignmentId', candidates.assignment_id,
              'cancelledAt', now()
            )
        from candidates
        where ta.id = candidates.assignment_id
        returning ta.id
      ),
      released_capacity as (
        update zigo.assistant_capacity_reservations acr
        set status_code = 'cancelled',
            released_at = now(),
            release_reason = 'Assistant delay',
            updated_at = now(),
            metadata = coalesce(acr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancelledBy', 'system',
              'cancellationReason', 'Booking slot expired',
              'cancellationReasonCode', 'booking_slot_expired',
              'autoCancelDelayMinutes', $1::int,
              'expiredAt', candidates.expiry_at,
              'assistantId', candidates.assistant_id,
              'assignmentId', candidates.assignment_id,
              'cancelledAt', now()
            )
        from candidates
        where acr.service_request_id = candidates.service_request_id
          and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        returning acr.id
      ),
      closed_orchestration as (
        update zigo.booking_orchestration_state os
        set demand_status = 'cancelled',
            risk_status = 'closed',
            supply_status = 'released',
            last_event_type = 'booking.auto_cancelled_assistant_delay',
            metadata = coalesce(os.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancelledBy', 'system',
              'cancellationReason', 'Booking slot expired',
              'cancellationReasonCode', 'booking_slot_expired',
              'autoCancelDelayMinutes', $1::int,
              'expiredAt', candidates.expiry_at,
              'assistantId', candidates.assistant_id,
              'assignmentId', candidates.assignment_id,
              'cancelledAt', now()
            ),
            updated_at = now()
        from candidates
        where os.service_request_id = candidates.service_request_id
        returning os.service_request_id
      ),
      cancelled_bookings as (
        update zigo.service_requests sr
        set status_code = 'cancelled',
            cancelled_reason = 'Booking slot expired',
            metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancelledBy', 'system',
              'cancellationReason', 'Booking slot expired',
              'cancellationReasonCode', 'booking_slot_expired',
              'plannedStartAt', candidates.planned_start_at,
              'expiredAt', candidates.expiry_at,
              'delayMinutes', candidates.delay_minutes,
              'autoCancelDelayMinutes', $1::int,
              'assistantId', candidates.assistant_id,
              'assignmentId', candidates.assignment_id,
              'cancelledAt', now()
            ),
            updated_at = now()
        from candidates
        where sr.id = candidates.service_request_id
        returning sr.id as service_request_id, candidates.cluster_id, candidates.assistant_id, candidates.assignment_id, candidates.planned_start_at, candidates.expiry_at, candidates.delay_minutes
      ),
      inserted_updates as (
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        select service_request_id, assignment_id, null, 'system', 'status',
          'Booking auto cancelled because booking slot expired before assistant started.',
          '[]'::jsonb,
          jsonb_build_object(
            'status', 'cancelled',
            'reason', 'Booking slot expired',
            'reasonCode', 'booking_slot_expired',
            'assistantId', assistant_id,
            'plannedStartAt', planned_start_at,
            'expiredAt', expiry_at,
            'delayMinutes', delay_minutes,
            'autoCancelDelayMinutes', $1::int,
            'cancelledAt', now()
          )
        from cancelled_bookings
        returning service_request_id
      )
      select
        service_request_id as "serviceRequestId",
        cluster_id as "clusterId",
        assistant_id as "assistantId",
        assignment_id as "assignmentId",
        planned_start_at as "plannedStartAt",
        delay_minutes as "delayMinutes"
      from cancelled_bookings
      join inserted_updates using (service_request_id)
    `, [autoCancelDelayMinutes, Math.max(1, Math.min(500, limit))]);
    const autoFinished = await client.query(`
      with candidates as (
        select
          sr.id as service_request_id,
          sr.cluster_id,
          ta.assistant_id,
          ta.id as assignment_id,
          coalesce(
            sr.booking_end_at,
            nullif(sr.metadata->>'taskEndAt', '')::timestamptz,
            nullif(sr.metadata->>'actualTaskEndAt', '')::timestamptz,
            nullif(sr.metadata->'taskTimer'->>'taskEndAt', '')::timestamptz
          ) as booking_end_at
        from zigo.service_requests sr
        join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        where coalesce(
            sr.booking_end_at,
            nullif(sr.metadata->>'taskEndAt', '')::timestamptz,
            nullif(sr.metadata->>'actualTaskEndAt', '')::timestamptz,
            nullif(sr.metadata->'taskTimer'->>'taskEndAt', '')::timestamptz
          ) is not null
          and coalesce(
            sr.booking_end_at,
            nullif(sr.metadata->>'taskEndAt', '')::timestamptz,
            nullif(sr.metadata->>'actualTaskEndAt', '')::timestamptz,
            nullif(sr.metadata->'taskTimer'->>'taskEndAt', '')::timestamptz
          ) <= now()
          and lower(coalesce(sr.status_code, '')) in ('in_progress', 'working')
          and lower(coalesce(ta.status_code, '')) in ('in_progress', 'working')
          and (sr.actual_task_started_at is not null or ta.actual_started_at is not null)
        order by sr.booking_end_at
        limit $1
        for update of sr, ta skip locked
      ),
      completed_assignments as (
        update zigo.task_assignments ta
        set status_code = 'completed',
            responded_at = coalesce(ta.responded_at, now()),
            metadata = coalesce(ta.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoFinished', true,
              'autoFinishedAt', now(),
              'autoFinishReasonCode', 'customer_not_share_finish_pin',
              'taskTimer', jsonb_build_object('status', 'completed', 'completedAt', now())
            )
        from candidates
        where ta.id = candidates.assignment_id
        returning ta.id
      ),
      completed_capacity as (
        update zigo.assistant_capacity_reservations acr
        set release_reason = 'Task auto completed, capacity held until available time',
            updated_at = now(),
            metadata = coalesce(acr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoFinished', true,
              'autoFinishedAt', now(),
              'autoFinishReasonCode', 'customer_not_share_finish_pin',
              'capacityHeldUntil', acr.reserved_until
            )
        from candidates
        where acr.service_request_id = candidates.service_request_id
          and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        returning acr.id
      ),
      completed_orchestration as (
        update zigo.booking_orchestration_state os
        set demand_status = 'completed',
            risk_status = 'closed',
            supply_status = 'released',
            last_event_type = 'booking.auto_finished',
            metadata = coalesce(os.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoFinished', true,
              'autoFinishedAt', now(),
              'autoFinishReasonCode', 'customer_not_share_finish_pin'
            ),
            updated_at = now()
        from candidates
        where os.service_request_id = candidates.service_request_id
        returning os.service_request_id
      ),
      completed_bookings as (
        update zigo.service_requests sr
        set status_code = 'completed',
            completed_at = coalesce(completed_at, now()),
            metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoFinished', true,
              'autoFinishedAt', now(),
              'autoFinishReasonCode', 'customer_not_share_finish_pin',
              'taskTimer', jsonb_build_object('status', 'completed', 'completedAt', now())
            ),
            updated_at = now()
        from candidates
        where sr.id = candidates.service_request_id
        returning sr.id as service_request_id, candidates.cluster_id, candidates.assistant_id, candidates.assignment_id, candidates.booking_end_at
      ),
      inserted_updates as (
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        select service_request_id, assignment_id, null, 'system', 'status',
          'Customer did not share finish PIN. Task auto completed at end time.',
          '[]'::jsonb,
          jsonb_build_object(
            'status', 'completed',
            'reasonCode', 'customer_not_share_finish_pin',
            'bookingEndAt', booking_end_at,
            'autoFinishedAt', now()
          )
        from completed_bookings
        returning service_request_id
      ),
      released_assistants as (
        update zigo.assistant_availability av
        set status_code = 'available',
            updated_at = now()
        from completed_bookings cb
        where av.assistant_id = cb.assistant_id
          and not exists (
            select 1
            from zigo.task_assignments active_ta
            join zigo.service_requests active_sr on active_sr.id = active_ta.service_request_id
            where active_ta.assistant_id = cb.assistant_id
              and active_ta.id <> cb.assignment_id
              and lower(coalesce(active_ta.status_code, '')) in ('in_progress', 'working')
              and lower(coalesce(active_sr.status_code, '')) in ('in_progress', 'working')
          )
          and not exists (
            select 1
            from zigo.assistant_capacity_reservations active_acr
            where active_acr.assistant_id = cb.assistant_id
              and active_acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
              and active_acr.reserved_until > now()
          )
        returning av.assistant_id
      )
      select
        service_request_id as "serviceRequestId",
        cluster_id as "clusterId",
        assistant_id as "assistantId",
        assignment_id as "assignmentId",
        booking_end_at as "bookingEndAt"
      from completed_bookings
      join inserted_updates using (service_request_id)
    `, [Math.max(1, Math.min(500, limit))]);
    const releasedExpiredCapacity = await client.query(`
      with candidates as (
        select
          acr.id as reservation_id,
          acr.service_request_id,
          acr.cluster_id,
          acr.assistant_id,
          acr.assignment_id,
          acr.reserved_until
        from zigo.assistant_capacity_reservations acr
        join zigo.service_requests sr on sr.id = acr.service_request_id
        where acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
          and acr.reserved_until <= now()
          and lower(coalesce(sr.status_code, '')) in ('completed', 'cancelled', 'canceled', 'failed', 'rejected')
        order by acr.reserved_until
        limit $1
        for update of acr skip locked
      ),
      released_capacity as (
        update zigo.assistant_capacity_reservations acr
        set status_code = 'completed',
            released_at = now(),
            release_reason = coalesce(acr.release_reason, 'Capacity window ended'),
            updated_at = now(),
            metadata = coalesce(acr.metadata, '{}'::jsonb) || jsonb_build_object(
              'capacityReleasedAt', now(),
              'capacityReleaseReasonCode', 'capacity_window_ended'
            )
        from candidates
        where acr.id = candidates.reservation_id
        returning
          acr.service_request_id,
          acr.cluster_id,
          acr.assistant_id,
          acr.assignment_id,
          acr.reserved_until
      ),
      released_assistants as (
        update zigo.assistant_availability av
        set status_code = 'available',
            updated_at = now()
        from released_capacity rc
        where av.assistant_id = rc.assistant_id
          and not exists (
            select 1
            from zigo.task_assignments active_ta
            join zigo.service_requests active_sr on active_sr.id = active_ta.service_request_id
            where active_ta.assistant_id = rc.assistant_id
              and lower(coalesce(active_ta.status_code, '')) in ('in_progress', 'working')
              and lower(coalesce(active_sr.status_code, '')) in ('in_progress', 'working')
          )
          and not exists (
            select 1
            from zigo.assistant_capacity_reservations active_acr
            where active_acr.assistant_id = rc.assistant_id
              and active_acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
              and active_acr.id is distinct from (
                select reservation_id from candidates c where c.service_request_id = rc.service_request_id and c.assistant_id is not distinct from rc.assistant_id limit 1
              )
              and active_acr.reserved_until > now()
          )
        returning av.assistant_id
      )
      select
        service_request_id as "serviceRequestId",
        cluster_id as "clusterId",
        assistant_id as "assistantId",
        assignment_id as "assignmentId",
        reserved_until as "reservedUntil"
      from released_capacity
    `, [Math.max(1, Math.min(500, limit))]);
    const due = await client.query(`
      select
        os.service_request_id as "serviceRequestId",
        os.cluster_id as "clusterId",
        os.risk_status as "previousRiskStatus",
        os.supply_status as "previousSupplyStatus",
        sr.status_code as "statusCode",
        os.booking_type as "bookingType",
        os.assign_type as "assignType",
        os.promised_start_at as "promisedStartAt",
        os.sla_deadline_at as "slaDeadlineAt",
        os.assistant_id as "assistantId",
        os.reservation_id as "reservationId",
        ta.id as "activeAssignmentId",
        ta.status_code as "activeAssignmentStatus",
        acr.status_code as "reservationStatus",
        acr.reserved_until as "reservedUntil"
      from zigo.booking_orchestration_state os
      join zigo.service_requests sr on sr.id = os.service_request_id
      left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
      left join zigo.assistant_capacity_reservations acr on acr.id = os.reservation_id
      where coalesce(os.next_check_at, now()) <= now()
        and os.risk_status <> 'closed'
        and sr.status_code not in ('completed', 'cancelled', 'failed', 'rejected')
      order by os.next_check_at nulls first, os.updated_at
      limit $1
      for update of os skip locked
    `, [Math.max(1, Math.min(500, limit))]);
    const changes = [];
    const now = new Date();
    for (const row of autoCancelled.rows) {
        const supplyStatus = row.assistantId ? "assigned" : "unassigned";
        changes.push({
            serviceRequestId: row.serviceRequestId,
            clusterId: row.clusterId,
            assistantId: row.assistantId,
            previousRiskStatus: "delayed",
            riskStatus: "closed",
            previousSupplyStatus: supplyStatus,
            supplyStatus: "released",
            eventType: "booking.cancelled",
            message: "Booking auto cancelled because booking slot expired before assistant started.",
            statusCode: "cancelled",
            status: "cancelled",
            autoCancelled: true,
            reason: "Booking slot expired",
            reasonCode: "booking_slot_expired",
            assignmentId: row.assignmentId,
            plannedStartAt: row.plannedStartAt,
            delayMinutes: row.delayMinutes,
            autoCancelDelayMinutes
        });
    }
    for (const row of autoFinished.rows) {
        changes.push({
            serviceRequestId: row.serviceRequestId,
            clusterId: row.clusterId,
            assistantId: row.assistantId,
            previousRiskStatus: "on_track",
            riskStatus: "closed",
            previousSupplyStatus: "working",
            supplyStatus: "released",
            eventType: "booking.updated",
            message: "Customer did not share finish PIN. Task auto completed at end time.",
            statusCode: "completed",
            status: "completed",
            assignmentId: row.assignmentId
        });
    }
    for (const row of releasedExpiredCapacity.rows) {
        changes.push({
            serviceRequestId: row.serviceRequestId,
            clusterId: row.clusterId,
            assistantId: row.assistantId,
            previousRiskStatus: "closed",
            riskStatus: "closed",
            previousSupplyStatus: "assigned",
            supplyStatus: "released",
            eventType: "booking.updated",
            message: "Assistant capacity released after wrap-up and travel buffer.",
            statusCode: "completed",
            status: "completed",
            assignmentId: row.assignmentId
        });
    }
    for (const row of due.rows) {
        let riskStatus = "on_time";
        let supplyStatus = row.assistantId ? "assigned" : "unassigned";
        let message = "Booking is on time.";
        if (!row.assistantId || !row.activeAssignmentId) {
            supplyStatus = "unassigned";
            if (row.promisedStartAt && row.promisedStartAt.getTime() - now.getTime() <= riskLookaheadMs) {
                riskStatus = "needs_manual_action";
                message = "Booking needs assistant assignment.";
            }
        }
        else if (row.reservationStatus && !["held", "reserved", "assigned"].includes(row.reservationStatus)) {
            supplyStatus = "released";
            riskStatus = "needs_manual_action";
            message = "Booking reservation was released.";
        }
        else if (row.slaDeadlineAt && row.slaDeadlineAt.getTime() < now.getTime()) {
            supplyStatus = "delayed";
            riskStatus = "delayed";
            message = "Booking has crossed SLA deadline.";
        }
        else if (row.promisedStartAt && row.promisedStartAt.getTime() < now.getTime() && !["accepted", "in_progress"].includes(row.statusCode)) {
            supplyStatus = "delayed";
            riskStatus = "at_risk";
            message = "Booking promised start time has arrived.";
        }
        else if (row.promisedStartAt && row.promisedStartAt.getTime() - now.getTime() <= riskLookaheadMs) {
            riskStatus = "at_risk";
            message = "Booking is approaching promised start time.";
        }
        const nextCheckAt = riskStatus === "delayed" || riskStatus === "needs_manual_action"
            ? new Date(now.getTime() + 60_000)
            : row.promisedStartAt && row.promisedStartAt.getTime() > now.getTime()
                ? new Date(Math.max(now.getTime() + 60_000, row.promisedStartAt.getTime() - riskLookaheadMs))
                : new Date(now.getTime() + steadyCheckMs);
        await client.query(`
        update zigo.booking_orchestration_state
        set risk_status = $2,
            supply_status = $3,
            next_check_at = $4,
            last_event_type = 'orchestration.checked',
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('lastCheckMessage', $5::text, 'lastCheckedAt', now()),
            updated_at = now()
        where service_request_id = $1::uuid
      `, [row.serviceRequestId, riskStatus, supplyStatus, nextCheckAt, message]);
        if (riskStatus !== row.previousRiskStatus || supplyStatus !== row.previousSupplyStatus) {
            changes.push({
                serviceRequestId: row.serviceRequestId,
                clusterId: row.clusterId,
                assistantId: row.assistantId,
                previousRiskStatus: row.previousRiskStatus,
                riskStatus,
                previousSupplyStatus: row.previousSupplyStatus,
                supplyStatus,
                message
            });
        }
    }
    return changes;
}
export async function getNextBookingOrchestrationDueAt(client = pool, options = {}) {
    await ensureBookingEngineSchema(client);
    const autoCancelDelayMinutes = Math.max(1, Number(options.customerAssistantDelayAutoCancelMinutes ?? 30));
    const result = await client.query(`
      with due_points as (
        select min(os.next_check_at) as due_at
        from zigo.booking_orchestration_state os
        join zigo.service_requests sr on sr.id = os.service_request_id
        where os.next_check_at is not null
          and os.risk_status <> 'closed'
          and lower(coalesce(sr.status_code, '')) not in ('completed', 'cancelled', 'canceled', 'failed', 'rejected')
        union all
        select min(coalesce(sr.booking_end_at, sr.booking_start_at + ($1::int || ' minutes')::interval)) as due_at
        from zigo.service_requests sr
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        where sr.booking_start_at is not null
          and lower(coalesce(sr.status_code, '')) in ('confirmed', 'processing', 'assigned', 'accepted', 'queued', 'paid', 'payment_pending', 'hold', 'on_hold')
          and (
            ta.id is null
            or (
              lower(coalesce(ta.status_code, '')) in ('accepted', 'assigned', 'reserved', 'offered')
              and ta.actual_started_at is null
            )
          )
          and sr.actual_task_started_at is null
        union all
        select min(coalesce(
            sr.booking_end_at,
            nullif(sr.metadata->>'taskEndAt', '')::timestamptz,
            nullif(sr.metadata->>'actualTaskEndAt', '')::timestamptz,
            nullif(sr.metadata->'taskTimer'->>'taskEndAt', '')::timestamptz
          )) as due_at
        from zigo.service_requests sr
        join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        where lower(coalesce(sr.status_code, '')) in ('in_progress', 'working')
          and lower(coalesce(ta.status_code, '')) in ('in_progress', 'working')
          and (sr.actual_task_started_at is not null or ta.actual_started_at is not null)
        union all
        select min(acr.reserved_until) as due_at
        from zigo.assistant_capacity_reservations acr
        join zigo.service_requests sr on sr.id = acr.service_request_id
        where acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
          and lower(coalesce(sr.status_code, '')) in ('completed', 'cancelled', 'canceled', 'failed', 'rejected')
      )
      select min(due_at) as "dueAt"
      from due_points
      where due_at is not null
    `, [autoCancelDelayMinutes]);
    return result.rows[0]?.dueAt ?? null;
}
