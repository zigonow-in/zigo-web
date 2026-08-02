import { pool } from "../../db/pool.js";

type Queryable = Pick<typeof pool, "query">;

let schemaReadyPromise: Promise<void> | null = null;

export type CapacityReservationInput = {
  serviceRequestId: string;
  assignmentId?: string | null;
  assistantId?: string | null;
  clusterId: string;
  bookingType: string;
  assignType: string;
  statusCode: "held" | "reserved" | "assigned" | "released" | "expired" | "completed" | "cancelled" | "replaced";
  reservedFrom: Date;
  reservedUntil: Date;
  promisedStartAt?: Date | null;
  slaDeadlineAt?: Date | null;
  source: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
};

export function ensureBookingEngineSchema(client: Queryable = pool) {
  if (client === pool && schemaReadyPromise) return schemaReadyPromise;
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
      where status_code in ('held', 'reserved', 'assigned');
    create index if not exists idx_capacity_reservations_cluster_window
      on zigo.assistant_capacity_reservations(cluster_id, reserved_from, reserved_until)
      where status_code in ('held', 'reserved', 'assigned');
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
      add column if not exists eta_minutes int not null default 0,
      add column if not exists wrap_up_minutes int not null default 0,
      add column if not exists travel_buffer_minutes int not null default 0,
      add column if not exists additional_details jsonb not null default '{}'::jsonb;
  `).then(() => undefined);
  if (client === pool) schemaReadyPromise = promise;
  return promise;
}

export async function upsertCapacityReservation(client: Queryable, input: CapacityReservationInput) {
  await ensureBookingEngineSchema(client);
  const result = await client.query<{ id: string }>(
    `
      insert into zigo.assistant_capacity_reservations
        (service_request_id, assignment_id, assistant_id, cluster_id, booking_type, assign_type, status_code,
         reserved_from, reserved_until, promised_start_at, sla_deadline_at, source, metadata, created_by_user_id)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
      returning id
    `,
    [
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
    ]
  );
  return result.rows[0];
}

export async function releaseCapacityReservations(client: Queryable, input: {
  serviceRequestId: string;
  exceptAssignmentId?: string | null;
  statusCode: "released" | "cancelled" | "completed" | "replaced" | "expired";
  reason: string;
}) {
  await ensureBookingEngineSchema(client);
  await client.query(
    `
      update zigo.assistant_capacity_reservations
      set status_code = $2,
          released_at = now(),
          release_reason = $3,
          updated_at = now()
      where service_request_id = $1
        and status_code in ('held', 'reserved', 'assigned')
        and ($4::uuid is null or assignment_id is distinct from $4::uuid)
    `,
    [input.serviceRequestId, input.statusCode, input.reason, input.exceptAssignmentId ?? null]
  );
}

export async function upsertBookingOrchestrationState(client: Queryable, input: {
  serviceRequestId: string;
  clusterId: string;
  demandStatus: string;
  riskStatus?: string;
  supplyStatus?: string;
  bookingType: string;
  assignType: string;
  requestedStartAt?: Date | null;
  promisedStartAt?: Date | null;
  slaDeadlineAt?: Date | null;
  assistantId?: string | null;
  reservationId?: string | null;
  nextCheckAt?: Date | null;
  lastEventType: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureBookingEngineSchema(client);
  await client.query(
    `
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
    `,
    [
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
    ]
  );
}

export async function runBookingOrchestrationCycle(client: Queryable = pool, limit = 100, options: {
  riskLookaheadMinutes?: number;
  slaGraceMinutes?: number;
} = {}) {
  await ensureBookingEngineSchema(client);
  const riskLookaheadMs = Math.max(1, Number(options.riskLookaheadMinutes ?? 15)) * 60_000;
  const steadyCheckMs = Math.max(1, Number(options.slaGraceMinutes ?? 5)) * 60_000;
  const due = await client.query<{
    serviceRequestId: string;
    clusterId: string;
    previousRiskStatus: string;
    previousSupplyStatus: string;
    statusCode: string;
    bookingType: string;
    assignType: string;
    promisedStartAt: Date | null;
    slaDeadlineAt: Date | null;
    assistantId: string | null;
    reservationId: string | null;
    activeAssignmentId: string | null;
    activeAssignmentStatus: string | null;
    reservationStatus: string | null;
    reservedUntil: Date | null;
  }>(
    `
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
    `,
    [Math.max(1, Math.min(500, limit))]
  );
  const changes: Array<{
    serviceRequestId: string;
    clusterId: string;
    assistantId: string | null;
    previousRiskStatus: string;
    riskStatus: string;
    previousSupplyStatus: string;
    supplyStatus: string;
    message: string;
  }> = [];
  const now = new Date();
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
    } else if (row.reservationStatus && !["held", "reserved", "assigned"].includes(row.reservationStatus)) {
      supplyStatus = "released";
      riskStatus = "needs_manual_action";
      message = "Booking reservation was released.";
    } else if (row.slaDeadlineAt && row.slaDeadlineAt.getTime() < now.getTime()) {
      supplyStatus = "delayed";
      riskStatus = "delayed";
      message = "Booking has crossed SLA deadline.";
    } else if (row.promisedStartAt && row.promisedStartAt.getTime() < now.getTime() && !["accepted", "in_progress"].includes(row.statusCode)) {
      supplyStatus = "delayed";
      riskStatus = "at_risk";
      message = "Booking promised start time has arrived.";
    } else if (row.promisedStartAt && row.promisedStartAt.getTime() - now.getTime() <= riskLookaheadMs) {
      riskStatus = "at_risk";
      message = "Booking is approaching promised start time.";
    }
    const nextCheckAt = riskStatus === "delayed" || riskStatus === "needs_manual_action"
      ? new Date(now.getTime() + 60_000)
      : row.promisedStartAt && row.promisedStartAt.getTime() > now.getTime()
        ? new Date(Math.max(now.getTime() + 60_000, row.promisedStartAt.getTime() - riskLookaheadMs))
        : new Date(now.getTime() + steadyCheckMs);
    await client.query(
      `
        update zigo.booking_orchestration_state
        set risk_status = $2,
            supply_status = $3,
            next_check_at = $4,
            last_event_type = 'orchestration.checked',
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('lastCheckMessage', $5::text, 'lastCheckedAt', now()),
            updated_at = now()
        where service_request_id = $1
      `,
      [row.serviceRequestId, riskStatus, supplyStatus, nextCheckAt, message]
    );
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
