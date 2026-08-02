import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { updateAssistantAvailability } from "../assistant-master/assistantMaster.repository.js";
import { createAdminCustomerAddress, listAdminCustomerAddresses } from "../customers/customers.repository.js";
import { getBookingCatalog, listBookingEngineQuickRepliesForBooking } from "../masters/masters.repository.js";
import { ensureBookingEngineSchema } from "../operations/bookingEngine.js";
import { createBookingByAdmin, getBookingAvailabilityDecision, reverseBookingLocation, searchBookingLocations, validateBookingLocation } from "../operations/operations.repository.js";
import { getBookingEngineSetting } from "../settings/settings.repository.js";
import { getUserById, sendEmailOtp, sendUserOtpChallenge, verifyUserOtpChallenge } from "../users/users.repository.js";

type PortalActor = "customer" | "assistant";
type TaskUpdateType =
  | "text"
  | "image"
  | "voice"
  | "video"
  | "file"
  | "location"
  | "status"
  | "payment_request"
  | "payment_response"
  | "approval_request"
  | "approval_response"
  | "time_extension_request"
  | "time_extension_approved";
type Queryable = Pick<typeof pool, "query">;
type PortalFavorites = {
  services: string[];
  categories: string[];
  stores: string[];
};

function normalizePhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith("91") ? `+${digits}` : `+${digits}`;
}

function phoneDigits(phone?: string | null) {
  return normalizePhone(phone).replace(/\D/g, "");
}

function normalizePortalFavoriteIds(value: unknown) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean))].slice(0, 500);
}

function normalizePortalFavorites(input: Partial<PortalFavorites> = {}): PortalFavorites {
  return {
    services: normalizePortalFavoriteIds(input.services),
    categories: normalizePortalFavoriteIds(input.categories),
    stores: normalizePortalFavoriteIds(input.stores)
  };
}

async function ensurePortalSchema(client: Queryable = pool) {
  await client.query(`
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
    create index if not exists idx_booking_task_updates_actor on zigo.booking_task_updates(actor_user_id, created_at desc);

    create table if not exists zigo.booking_task_update_reads (
      update_id uuid not null references zigo.booking_task_updates(id) on delete cascade,
      user_id uuid not null references zigo.users(id) on delete cascade,
      actor_type text not null,
      read_at timestamptz not null default now(),
      primary key (update_id, user_id)
    );
    create index if not exists idx_booking_task_update_reads_user on zigo.booking_task_update_reads(user_id, read_at desc);

    create table if not exists zigo.portal_favorites (
      user_id uuid not null references zigo.users(id) on delete cascade,
      actor_type text not null,
      favorite_type text not null,
      object_id text not null,
      created_at timestamptz not null default now(),
      primary key (user_id, actor_type, favorite_type, object_id)
    );
    create index if not exists idx_portal_favorites_user on zigo.portal_favorites(user_id, actor_type, favorite_type);

    create table if not exists zigo.customer_cart (
      customer_id uuid primary key references zigo.customers(id) on delete cascade,
      user_id uuid not null references zigo.users(id) on delete cascade,
      cart_items jsonb not null default '[]'::jsonb,
      customer_note text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_customer_cart_user on zigo.customer_cart(user_id, updated_at desc);
    alter table zigo.customer_cart add column if not exists customer_note text not null default '';
  `);
}

async function setAssistantAvailabilityForPortalTask(client: Queryable, assistantId: string, status: "accepted" | "in_progress" | "completed" | "rejected") {
  const activeWork = await client.query<{ id: string }>(
    `
      select ta.id
      from zigo.task_assignments ta
      join zigo.service_requests sr on sr.id = ta.service_request_id or sr.id = ta.request_id
      where ta.assistant_id = $1
        and ta.status_code in ('in_progress', 'approval_pending')
        and sr.status_code in ('in_progress', 'approval_pending')
      limit 1
    `,
    [assistantId]
  );
  const availabilityStatus = status === "in_progress" || activeWork.rows[0] ? "working" : "available";
  await client.query(
    `
      insert into zigo.assistant_availability
        (assistant_id, status_code, online_started_at, today_online_seconds, today_online_date, updated_at)
      values ($1, $2::text, now(), 0, current_date, now())
      on conflict (assistant_id)
      do update set
        status_code = $2::text,
        online_started_at = case
          when zigo.assistant_availability.today_online_date = current_date
            and zigo.assistant_availability.status_code in ('available', 'online', 'active', 'working')
            and zigo.assistant_availability.online_started_at is not null
          then zigo.assistant_availability.online_started_at
          else now()
        end,
        today_online_seconds = case
          when zigo.assistant_availability.today_online_date = current_date then zigo.assistant_availability.today_online_seconds
          else 0
        end,
        today_online_date = current_date,
        updated_at = now()
    `,
    [assistantId, availabilityStatus]
  );
}

async function taskUpdatesByBookingIds(client: Queryable, bookingIds: string[], viewer?: { userId: string; actor: PortalActor }) {
  if (!bookingIds.length) return new Map<string, unknown[]>();
  const result = await client.query(
    `
      select btu.service_request_id as "bookingId", btu.id, btu.actor_type as "actorType",
        btu.update_type as "updateType", btu.message, btu.media_urls as "mediaUrls",
        coalesce(btu.metadata, '{}'::jsonb) as metadata, btu.created_at as "createdAt",
        btr.read_at as "viewerReadAt",
        case when $3::text = 'customer' then btr.read_at else null end as "customerReadAt",
        case when $3::text = 'assistant' then btr.read_at else null end as "assistantReadAt",
        u.display_name as "actorName"
      from zigo.booking_task_updates btu
      left join zigo.users u on u.id = btu.actor_user_id
      left join zigo.booking_task_update_reads btr
        on btr.update_id = btu.id
       and btr.user_id = $2::uuid
      where btu.service_request_id = any($1::uuid[])
      order by btu.service_request_id, btu.created_at desc
    `,
    [bookingIds, viewer?.userId ?? null, viewer?.actor ?? null]
  );
  const grouped = new Map<string, unknown[]>();
  for (const row of result.rows) {
    const bookingId = row.bookingId;
    const rows = grouped.get(bookingId) || [];
    if (rows.length < 30) rows.push(row);
    grouped.set(bookingId, rows);
  }
  return grouped;
}

export async function markPortalBookingTaskUpdatesRead(userId: string, actor: PortalActor, bookingId: string) {
  await ensurePortalSchema();
  const relation = actor === "customer"
    ? await pool.query<{ bookingId: string; customerUserId: string | null; assistantId: string | null }>(
      `
        select sr.id as "bookingId", cu.user_id as "customerUserId", a.id as "assistantId"
        from zigo.service_requests sr
        join zigo.customers cu on cu.id = sr.customer_id
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        left join zigo.assistants a on a.id = ta.assistant_id
        where sr.id = $1 and cu.user_id = $2
        limit 1
      `,
      [bookingId, userId]
    )
    : await pool.query<{ bookingId: string; customerUserId: string | null; assistantId: string | null }>(
      `
        select sr.id as "bookingId", cu.user_id as "customerUserId", a.id as "assistantId"
        from zigo.service_requests sr
        join zigo.task_assignments ta on ta.service_request_id = sr.id
        join zigo.assistants a on a.id = ta.assistant_id
        left join zigo.customers cu on cu.id = sr.customer_id
        where sr.id = $1 and a.user_id = $2
        limit 1
      `,
      [bookingId, userId]
    );
  const linked = relation.rows[0];
  if (!linked) throw new HttpError(403, "This booking is not linked with your account.");
  const counterpartActor = actor === "customer" ? "assistant" : "customer";
  const result = await pool.query<{ updateId: string }>(
    `
      insert into zigo.booking_task_update_reads (update_id, user_id, actor_type, read_at)
      select btu.id, $2::uuid, $3::text, now()
      from zigo.booking_task_updates btu
      where btu.service_request_id = $1
        and btu.actor_type = $4
      on conflict (update_id, user_id)
      do update set read_at = excluded.read_at, actor_type = excluded.actor_type
      returning update_id as "updateId"
    `,
    [bookingId, userId, actor, counterpartActor]
  );
  return {
    bookingId,
    readCount: result.rowCount || 0,
    customerUserId: linked.customerUserId,
    assistantId: linked.assistantId
  };
}

export async function listPortalBookingQuickReplies(userId: string, actor: PortalActor, bookingId: string) {
  await ensurePortalSchema();
  const relation = actor === "customer"
    ? await pool.query<{ bookingId: string }>(
      `
        select sr.id as "bookingId"
        from zigo.service_requests sr
        join zigo.customers cu on cu.id = sr.customer_id
        where sr.id = $1 and cu.user_id = $2
        limit 1
      `,
      [bookingId, userId]
    )
    : await pool.query<{ bookingId: string }>(
      `
        select sr.id as "bookingId"
        from zigo.service_requests sr
        join zigo.task_assignments ta on ta.service_request_id = sr.id or ta.request_id = sr.id
        join zigo.assistants a on a.id = ta.assistant_id
        where sr.id = $1 and a.user_id = $2
        limit 1
      `,
      [bookingId, userId]
    );
  if (!relation.rows[0]) throw new HttpError(403, "This booking is not linked with your account.");
  return listBookingEngineQuickRepliesForBooking({ bookingId, actor });
}

const FINISH_CONFIRMATION_MINUTES = 5;
const FINISH_CONFIRMATION_PURPOSE = "finish_confirmation";

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Record<string, any>[] : [];
}

function numberValue(value: unknown, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function paiseValue(value: unknown, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.round(amount));
}

function rupeeToPaise(value: unknown, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.round(amount * 100));
}

function dateValue(...values: unknown[]) {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function waitingChargeFromSource(source: unknown) {
  const row = asObject(source);
  if (!Object.keys(row).length) return null;
  const waitingRaw = asObject(row.waitingCharge);
  const sourceLooksLikeWaiting = row.chargePerMinutes != null || row.waitingChargeMinutes != null || row.waitingMinutes != null;
  const amountPaise = paiseValue(
    waitingRaw.amountPaise
      ?? waitingRaw.waitingChargePaise
      ?? row.waitingChargePaise
      ?? row.waitingChargesPaise,
    -1
  );
  const amount = amountPaise >= 0
    ? amountPaise
    : rupeeToPaise(
      waitingRaw.amount
        ?? waitingRaw.waitingCharge
        ?? row.waitingChargeAmount
        ?? (typeof row.waitingCharge === "number" || typeof row.waitingCharge === "string" ? row.waitingCharge : undefined)
        ?? (sourceLooksLikeWaiting ? row.amount : undefined),
      0
    );
  const chargePerMinutes = Math.max(0, Math.round(numberValue(
    waitingRaw.chargePerMinutes
      ?? waitingRaw.minutes
      ?? waitingRaw.durationMinutes
      ?? row.chargePerMinutes
      ?? row.waitingChargeMinutes
      ?? row.waitingMinutes,
    0
  )));
  if (amount <= 0 || chargePerMinutes <= 0) return null;
  return { amountPaise: amount, chargePerMinutes };
}

function waitingChargeRuleFromBooking(metadata: Record<string, any>) {
  const candidates: Array<{ amountPaise: number; chargePerMinutes: number; weight: number }> = [];
  const addCandidate = (source: unknown, weight = 0) => {
    const rule = waitingChargeFromSource(source);
    if (rule) candidates.push({ ...rule, weight });
  };
  addCandidate(metadata.waitingCharge, 1);
  addCandidate(metadata.allottedTime, 1);
  asArray(asObject(metadata.priceMasterQuote).lineItems).forEach((line, index) => {
    addCandidate(line, numberValue(line.amount ?? line.sellingPrice ?? 0, 0) || index);
  });
  asArray(metadata.cartItems).forEach((item) => {
    addCandidate(item, numberValue(item.sellingPricePaise ?? item.sellingPrice ?? item.price ?? 0, 0));
  });
  return candidates.sort((a, b) => b.weight - a.weight || b.amountPaise - a.amountPaise || b.chargePerMinutes - a.chargePerMinutes)[0] || null;
}

function finishTimerSnapshot(row: {
  durationMinutes?: number | null;
  bookingMetadata?: Record<string, any> | null;
  assignmentMetadata?: Record<string, any> | null;
  assignmentRespondedAt?: string | null;
  waitingTimeMinutes?: number | null;
  waitingChargesPaise?: number | null;
}, at = new Date()) {
  const bookingMetadata = asObject(row.bookingMetadata);
  const assignmentMetadata = asObject(row.assignmentMetadata);
  const durationMinutes = Math.max(1, Math.round(numberValue(row.durationMinutes, 30)));
  const startedAt = dateValue(
    assignmentMetadata.startedAt,
    bookingMetadata.startedAt,
    bookingMetadata.taskTimer?.startedAt,
    row.assignmentRespondedAt
  );
  const expectedFreeAt = dateValue(
    bookingMetadata.expectedFreeAt,
    assignmentMetadata.expectedFreeAt,
    bookingMetadata.taskTimer?.expectedFreeAt
  ) || (startedAt ? new Date(startedAt.getTime() + durationMinutes * 60_000) : null);
  const waitingMinutes = expectedFreeAt ? Math.max(0, Math.ceil((at.getTime() - expectedFreeAt.getTime()) / 60_000)) : 0;
  const rule = waitingChargeRuleFromBooking(bookingMetadata);
  const waitingChargesPaise = rule && waitingMinutes > 0
    ? Math.ceil(waitingMinutes / rule.chargePerMinutes) * rule.amountPaise
    : 0;
  return {
    startedAt: startedAt ? startedAt.toISOString() : null,
    expectedFreeAt: expectedFreeAt ? expectedFreeAt.toISOString() : null,
    taskTotalMinutes: durationMinutes,
    waitingMinutes,
    waitingChargesPaise,
    waitingChargeAmountPaise: rule?.amountPaise || 0,
    waitingChargePerMinutes: rule?.chargePerMinutes || 0,
    previousWaitingMinutes: Math.max(0, Math.round(numberValue(row.waitingTimeMinutes, 0))),
    previousWaitingChargesPaise: Math.max(0, Math.round(numberValue(row.waitingChargesPaise, 0)))
  };
}

async function applyFinishCompletion(client: Queryable, row: {
  bookingId: string;
  assignmentId: string | null;
  bookingAmountPaise?: number | null;
  waitingChargesPaise?: number | null;
  requestUpdateId?: string | null;
  requestMetadata?: Record<string, any> | null;
  bookingMetadata?: Record<string, any> | null;
  assignmentMetadata?: Record<string, any> | null;
  durationMinutes?: number | null;
  assignmentRespondedAt?: string | null;
}, input: { auto?: boolean; completedAt?: Date } = {}) {
  await ensureBookingEngineSchema(client);
  const completedAt = input.completedAt || new Date();
  const requestMetadata = asObject(row.requestMetadata);
  const requestedAt = dateValue(requestMetadata.finishRequestedAt, requestMetadata.timerHeldAt, completedAt) || completedAt;
  const computed = finishTimerSnapshot(row, requestedAt);
  const waitingMinutes = Math.max(0, Math.round(numberValue(requestMetadata.waitingMinutesAtRequest, computed.waitingMinutes)));
  const waitingChargesPaise = Math.max(0, Math.round(numberValue(requestMetadata.waitingChargesPaiseAtRequest, computed.waitingChargesPaise)));
  const previousWaitingCharges = Math.max(0, Math.round(numberValue(row.waitingChargesPaise, 0)));
  const baseBookingAmount = Math.max(0, Math.round(numberValue(row.bookingAmountPaise, 0)) - previousWaitingCharges);
  const totalBookingAmount = baseBookingAmount + waitingChargesPaise;
  const timer = {
    status: "completed",
    startedAt: computed.startedAt,
    expectedFreeAt: computed.expectedFreeAt,
    completedAt: completedAt.toISOString(),
    finishRequestedAt: requestedAt.toISOString(),
    taskTotalMinutes: computed.taskTotalMinutes,
    waitingMinutes,
    waitingChargesPaise,
    waitingChargeAmountPaise: computed.waitingChargeAmountPaise,
    waitingChargePerMinutes: computed.waitingChargePerMinutes,
    autoCompleted: Boolean(input.auto)
  };
  await client.query(
    `
      update zigo.service_requests
      set status_code = 'completed',
          completed_at = now(),
          waiting_time_minutes = $2::int,
          waiting_charges_paise = $3::bigint,
          booking_amount_paise = $4::bigint,
          payment_details = coalesce(payment_details, '{}'::jsonb) || $5::jsonb,
          metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
          updated_at = now()
      where id = $1
    `,
    [
      row.bookingId,
      waitingMinutes,
      waitingChargesPaise,
      totalBookingAmount,
      JSON.stringify({ waitingTimeMinutes: waitingMinutes, waitingChargesPaise, finalAmountPaise: totalBookingAmount }),
      JSON.stringify({
        finishConfirmationPending: false,
        finishConfirmedAt: completedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        timerStatus: "completed",
        waitingTimeMinutes: waitingMinutes,
        waitingChargesPaise,
        taskTimer: timer
      })
    ]
  );
  if (row.assignmentId) {
    const assignmentAssistant = await client.query<{ assistantId: string }>(
      "select assistant_id as \"assistantId\" from zigo.task_assignments where id = $1 limit 1",
      [row.assignmentId]
    );
    await client.query(
      `
        update zigo.task_assignments
        set status_code = 'completed',
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [row.assignmentId, JSON.stringify({ finishConfirmationPending: false, completedAt: completedAt.toISOString(), taskTimer: timer })]
    );
    await client.query(
      `
        update zigo.assistant_capacity_reservations
        set status_code = 'completed',
            released_at = now(),
            release_reason = 'task_completed',
            updated_at = now()
        where assignment_id = $1 and status_code in ('held', 'reserved', 'assigned')
      `,
      [row.assignmentId]
    );
    if (assignmentAssistant.rows[0]?.assistantId) {
      await setAssistantAvailabilityForPortalTask(client, assignmentAssistant.rows[0].assistantId, "completed");
    }
  }
  if (row.requestUpdateId) {
    await client.query(
      `
        update zigo.booking_task_updates
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [row.requestUpdateId, JSON.stringify({ status: input.auto ? "auto_completed" : "approved", completedAt: completedAt.toISOString(), waitingTimeMinutes: waitingMinutes, waitingChargesPaise })]
    );
  }
  return { waitingTimeMinutes: waitingMinutes, waitingChargesPaise, totalBookingAmountPaise: totalBookingAmount };
}

async function completeExpiredFinishConfirmations(client: Queryable = pool) {
  await ensurePortalSchema(client);
  await ensureBookingEngineSchema(client);
  const result = await client.query<{
    requestUpdateId: string;
    bookingId: string;
    assignmentId: string | null;
    customerUserId: string | null;
    assistantId: string | null;
    durationMinutes: number | null;
    bookingAmountPaise: number | null;
    waitingTimeMinutes: number | null;
    waitingChargesPaise: number | null;
    requestMetadata: Record<string, any> | null;
    bookingMetadata: Record<string, any> | null;
    assignmentMetadata: Record<string, any> | null;
    assignmentRespondedAt: string | null;
  }>(
    `
      select btu.id as "requestUpdateId", sr.id as "bookingId", coalesce(btu.task_assignment_id, sr.accepted_assignment_id) as "assignmentId",
        cu.user_id as "customerUserId", a.id as "assistantId",
        sr.duration_minutes as "durationMinutes", sr.booking_amount_paise as "bookingAmountPaise",
        sr.waiting_time_minutes as "waitingTimeMinutes", sr.waiting_charges_paise as "waitingChargesPaise",
        coalesce(btu.metadata, '{}'::jsonb) as "requestMetadata",
        coalesce(sr.metadata, '{}'::jsonb) as "bookingMetadata",
        coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
        ta.responded_at as "assignmentRespondedAt"
      from zigo.booking_task_updates btu
      join zigo.service_requests sr on sr.id = btu.service_request_id
      join zigo.customers cu on cu.id = sr.customer_id
      left join zigo.task_assignments ta on ta.id = coalesce(btu.task_assignment_id, sr.accepted_assignment_id)
      left join zigo.assistants a on a.id = ta.assistant_id
      where btu.update_type = 'approval_request'
        and coalesce(btu.metadata->>'purpose', '') = $1
        and coalesce(btu.metadata->>'status', 'pending') = 'pending'
        and coalesce(nullif(btu.metadata->>'confirmBy', '')::timestamptz, btu.created_at + interval '5 minutes') <= now()
        and sr.status_code = 'approval_pending'
      order by btu.created_at
      limit 25
    `,
    [FINISH_CONFIRMATION_PURPOSE]
  );
  for (const row of result.rows) {
    await applyFinishCompletion(client, row, { auto: true });
    await client.query(
      `
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1, $2, null, 'system', 'approval_response', $3, '[]'::jsonb, $4::jsonb)
      `,
      [
        row.bookingId,
        row.assignmentId,
        "Task auto completed because customer did not respond within 5 minutes.",
        JSON.stringify({ sourceUpdateId: row.requestUpdateId, purpose: FINISH_CONFIRMATION_PURPOSE, response: "yes", autoCompleted: true, respondedAt: new Date().toISOString() })
      ]
    );
  }
}

async function autoCancelExpiredUnstartedTasks(client: Queryable = pool) {
  await ensurePortalSchema(client);
  await ensureBookingEngineSchema(client);
  const result = await client.query<{
    bookingId: string;
    assignmentId: string | null;
    reason: string;
  }>(
    `
      with candidates as (
        select sr.id as "bookingId",
          coalesce(ta.id, sr.accepted_assignment_id) as "assignmentId",
          case
            when coalesce(ta.id, sr.accepted_assignment_id) is null then 'Assistant not assigned'
            else 'Assistant not start working'
          end as reason,
          due.end_at as "endAt"
        from zigo.service_requests sr
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        cross join lateral (
          select candidate.end_at
          from (values
            (1, case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\\d{4}-' then (sr.metadata->>'expectedFreeAt')::timestamptz end),
            (2, case when sr.scheduled_at is not null then sr.scheduled_at + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval end),
            (3, case when coalesce(sr.metadata->>'scheduledAt', '') ~ '^\\d{4}-' then (sr.metadata->>'scheduledAt')::timestamptz + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval end),
            (4, case
              when coalesce(sr.metadata->'schedule'->>'scheduledDate', sr.metadata->'schedule'->>'date', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
               and coalesce(sr.metadata->'schedule'->>'scheduledTime', sr.metadata->'schedule'->>'time', '') ~ '^\\d{2}:\\d{2}'
              then ((coalesce(sr.metadata->'schedule'->>'scheduledDate', sr.metadata->'schedule'->>'date'))::date + left(coalesce(sr.metadata->'schedule'->>'scheduledTime', sr.metadata->'schedule'->>'time'), 5)::time)::timestamptz + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval
            end),
            (5, case
              when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
               and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\\d{2}:\\d{2}'
              then ((sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time)::timestamptz + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval
            end),
            (6, case when coalesce(sr.metadata->>'bookingStartAt', '') ~ '^\\d{4}-' then (sr.metadata->>'bookingStartAt')::timestamptz + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval end),
            (7, case when coalesce(sr.metadata->>'startAt', '') ~ '^\\d{4}-' then (sr.metadata->>'startAt')::timestamptz + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval end),
            (8, case when ta.assigned_at is not null then ta.assigned_at + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval end),
            (9, sr.created_at + (greatest(coalesce(sr.duration_minutes, 30), 1) || ' minutes')::interval)
          ) as candidate(priority, end_at)
          where candidate.end_at is not null
          order by candidate.priority
          limit 1
        ) due
        where lower(coalesce(sr.status_code, '')) in ('confirmed', 'pending', 'processing', 'payment_pending', 'paid', 'queued', 'assigned', 'accepted')
          and lower(coalesce(ta.status_code, '')) not in ('in_progress', 'completed', 'cancelled', 'canceled', 'rejected')
          and due.end_at < now()
        limit 100
      ),
      cancelled_assignments as (
        update zigo.task_assignments ta
        set status_code = 'cancelled',
            responded_at = coalesce(ta.responded_at, now()),
            metadata = coalesce(ta.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancellationReason', candidates.reason,
              'autoCancelReason', case when candidates.reason = 'Assistant not assigned' then 'assistant_not_assigned' else 'assistant_not_start_working' end,
              'cancelledAt', now(),
              'cancelledBy', 'system'
            )
        from candidates
        where ta.id = candidates."assignmentId"
        returning ta.id
      ),
      released_capacity as (
        update zigo.assistant_capacity_reservations acr
        set status_code = 'cancelled',
            released_at = now(),
            release_reason = candidates.reason,
            updated_at = now(),
            metadata = coalesce(acr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancellationReason', candidates.reason
            )
        from candidates
        where acr.service_request_id = candidates."bookingId"
          and acr.status_code in ('held', 'reserved', 'assigned')
        returning acr.id
      ),
      cancelled_bookings as (
        update zigo.service_requests sr
        set status_code = 'cancelled',
            accepted_assignment_id = null,
            cancelled_reason = candidates.reason,
            metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object(
              'autoCancelled', true,
              'cancellationReason', candidates.reason,
              'autoCancelReason', case when candidates.reason = 'Assistant not assigned' then 'assistant_not_assigned' else 'assistant_not_start_working' end,
              'cancelledAt', now(),
              'cancelledBy', 'system'
            ),
            updated_at = now()
        from candidates
        where sr.id = candidates."bookingId"
        returning sr.id as "bookingId", candidates."assignmentId", candidates.reason
      )
      insert into zigo.booking_task_updates
        (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
      select "bookingId", "assignmentId", null, 'system', 'status',
        'Booking auto cancelled. ' || reason,
        '[]'::jsonb,
        jsonb_build_object(
          'status', 'cancelled',
          'reason', reason,
          'autoCancelled', true,
          'autoCancelReason', case when reason = 'Assistant not assigned' then 'assistant_not_assigned' else 'assistant_not_start_working' end,
          'cancelledAt', now()
        )
      from cancelled_bookings
      returning service_request_id as "bookingId", task_assignment_id as "assignmentId", metadata->>'reason' as reason
    `
  );
  return result.rows;
}

async function handleFinishConfirmationResponse(input: {
  userId: string;
  sourceUpdateId: string;
  responseUpdateId: string;
  response: "yes" | "no";
}) {
  if (!input.sourceUpdateId) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensurePortalSchema(client);
    await ensureBookingEngineSchema(client);
    const result = await client.query<{
      requestUpdateId: string;
      bookingId: string;
      assignmentId: string | null;
      durationMinutes: number | null;
      bookingAmountPaise: number | null;
      waitingTimeMinutes: number | null;
      waitingChargesPaise: number | null;
      requestMetadata: Record<string, any> | null;
      bookingMetadata: Record<string, any> | null;
      assignmentMetadata: Record<string, any> | null;
      assignmentRespondedAt: string | null;
    }>(
      `
        select btu.id as "requestUpdateId", sr.id as "bookingId", coalesce(btu.task_assignment_id, sr.accepted_assignment_id) as "assignmentId",
          sr.duration_minutes as "durationMinutes", sr.booking_amount_paise as "bookingAmountPaise",
          sr.waiting_time_minutes as "waitingTimeMinutes", sr.waiting_charges_paise as "waitingChargesPaise",
          coalesce(btu.metadata, '{}'::jsonb) as "requestMetadata",
          coalesce(sr.metadata, '{}'::jsonb) as "bookingMetadata",
          coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
          ta.responded_at as "assignmentRespondedAt"
        from zigo.booking_task_updates btu
        join zigo.service_requests sr on sr.id = btu.service_request_id
        join zigo.customers cu on cu.id = sr.customer_id
        left join zigo.task_assignments ta on ta.id = coalesce(btu.task_assignment_id, sr.accepted_assignment_id)
        where btu.id = $1
          and cu.user_id = $2
          and btu.update_type = 'approval_request'
          and coalesce(btu.metadata->>'purpose', '') = $3
        limit 1
        for update of btu, sr
      `,
      [input.sourceUpdateId, input.userId, FINISH_CONFIRMATION_PURPOSE]
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("commit");
      return null;
    }
    const requestMetadata = asObject(row.requestMetadata);
    const currentStatus = String(requestMetadata.status || "pending").toLowerCase();
    if (currentStatus !== "pending") {
      await client.query("commit");
      return { bookingId: row.bookingId, alreadyHandled: true };
    }
    if (input.response === "yes") {
      const completion = await applyFinishCompletion(client, row, { auto: false });
      await client.query(
        `
          update zigo.booking_task_updates
          set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1
        `,
        [input.responseUpdateId, JSON.stringify({ purpose: FINISH_CONFIRMATION_PURPOSE, status: "completed", waitingTimeMinutes: completion.waitingTimeMinutes, waitingChargesPaise: completion.waitingChargesPaise })]
      );
      await client.query("commit");
      return { bookingId: row.bookingId, completed: true };
    }

    const respondedAt = new Date();
    const heldAt = dateValue(requestMetadata.timerHeldAt, requestMetadata.finishRequestedAt, respondedAt) || respondedAt;
    const heldMs = Math.max(0, respondedAt.getTime() - heldAt.getTime());
    const oldExpected = dateValue(requestMetadata.expectedFreeAt, row.bookingMetadata?.expectedFreeAt, row.assignmentMetadata?.expectedFreeAt);
    const nextExpected = oldExpected ? new Date(oldExpected.getTime() + heldMs) : null;
    const snapshot = finishTimerSnapshot(row, heldAt);
    const waitingMinutes = Math.max(0, Math.round(numberValue(requestMetadata.waitingMinutesAtRequest, snapshot.waitingMinutes)));
    const waitingChargesPaise = Math.max(0, Math.round(numberValue(requestMetadata.waitingChargesPaiseAtRequest, snapshot.waitingChargesPaise)));
    const previousWaitingCharges = Math.max(0, Math.round(numberValue(row.waitingChargesPaise, 0)));
    const baseBookingAmount = Math.max(0, Math.round(numberValue(row.bookingAmountPaise, 0)) - previousWaitingCharges);
    const totalBookingAmount = baseBookingAmount + waitingChargesPaise;
    await client.query(
      `
        update zigo.booking_task_updates
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [row.requestUpdateId, JSON.stringify({ status: "rejected", rejectedAt: respondedAt.toISOString(), waitingTimeMinutes: waitingMinutes, waitingChargesPaise })]
    );
    await client.query(
      `
        update zigo.service_requests
        set status_code = 'in_progress',
            waiting_time_minutes = $2::int,
            waiting_charges_paise = $3::bigint,
            booking_amount_paise = $4::bigint,
            payment_details = coalesce(payment_details, '{}'::jsonb) || $5::jsonb,
            metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        row.bookingId,
        waitingMinutes,
        waitingChargesPaise,
        totalBookingAmount,
        JSON.stringify({ waitingTimeMinutes: waitingMinutes, waitingChargesPaise, finalAmountPaise: totalBookingAmount }),
        JSON.stringify({
          finishConfirmationPending: false,
          finishRejectedAt: respondedAt.toISOString(),
          timerStatus: "running",
          expectedFreeAt: nextExpected ? nextExpected.toISOString() : undefined,
          waitingTimeMinutes: waitingMinutes,
          waitingChargesPaise,
          taskTimer: {
            status: "running",
            expectedFreeAt: nextExpected ? nextExpected.toISOString() : undefined,
            finishRejectedAt: respondedAt.toISOString(),
            heldMs,
            waitingMinutes,
            waitingChargesPaise
          }
        })
      ]
    );
    if (row.assignmentId) {
      await client.query(
        `
          update zigo.task_assignments
          set status_code = 'in_progress',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1
        `,
        [row.assignmentId, JSON.stringify({ finishConfirmationPending: false, finishRejectedAt: respondedAt.toISOString(), expectedFreeAt: nextExpected ? nextExpected.toISOString() : undefined, taskTimer: { status: "running", expectedFreeAt: nextExpected ? nextExpected.toISOString() : undefined, finishRejectedAt: respondedAt.toISOString(), heldMs } })]
      );
    }
    await client.query("commit");
    return { bookingId: row.bookingId, completed: false };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function roleIdByCode(client: Queryable, code: string) {
  const result = await client.query<{ id: string }>(
    "select id from zigo.roles where code = $1 and coalesce(is_deleted, false) = false limit 1",
    [code]
  );
  return result.rows[0]?.id ?? null;
}

async function findPortalUserByPhone(client: Queryable, actor: PortalActor, phone: string) {
  const digits = phoneDigits(phone);
  const result = await client.query<{ userId: string; customerId: string | null; assistantId: string | null }>(
    `
      select u.id as "userId", c.id as "customerId", a.id as "assistantId"
      from zigo.users u
      join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false and coalesce(ur.is_active, true) = true
      join zigo.roles r on r.id = ur.role_id and r.code = $1
      left join zigo.customers c on c.user_id = u.id
      left join zigo.assistants a on a.user_id = u.id
      where u.deleted_at is null
        and regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g') = $2
      order by u.created_at desc
      limit 1
    `,
    [actor, digits]
  );
  return result.rows[0] ?? null;
}

async function findAnyUserByPhone(client: Queryable, phone: string) {
  const digits = phoneDigits(phone);
  const result = await client.query<{ userId: string; customerId: string | null; assistantId: string | null }>(
    `
      select u.id as "userId", c.id as "customerId", a.id as "assistantId"
      from zigo.users u
      left join zigo.customers c on c.user_id = u.id
      left join zigo.assistants a on a.user_id = u.id
      where u.deleted_at is null
        and regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g') = $1
      order by u.created_at desc
      limit 1
    `,
    [digits]
  );
  return result.rows[0] ?? null;
}

function metadataFlag(metadata: Record<string, unknown> | null | undefined, key: string, fallback = false) {
  const value = metadata?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  return fallback;
}

function metadataHas(metadata: Record<string, unknown> | null | undefined, key: string) {
  return Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, key));
}

function passwordLoginAllowed(metadata: Record<string, unknown> | null | undefined, hasPassword: boolean) {
  const hasModernFlag = metadataHas(metadata, "isLoginWithPassword");
  const hasLegacyFlag = metadataHas(metadata, "loginWithPassword");
  if (hasModernFlag) return metadataFlag(metadata, "isLoginWithPassword");
  if (hasLegacyFlag) return metadataFlag(metadata, "loginWithPassword");
  return hasPassword;
}

function accountCanUsePortal(metadata: Record<string, unknown> | null | undefined) {
  const status = String(metadata?.accountStatus || metadata?.verificationStatus || "active").toLowerCase();
  return !["inactive", "deactive", "deactivated", "deleted", "blocked"].includes(status);
}

function normalizeIdentifier(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  return {
    raw,
    email: raw.toLowerCase(),
    phoneDigits: digits.length >= 6 ? digits.slice(-10) : ""
  };
}

async function findAssistantForPasswordLogin(client: Queryable, identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  const result = await client.query<{
    userId: string;
    assistantId: string | null;
    email: string | null;
    phone: string | null;
    passwordHash: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `
      select u.id as "userId", a.id as "assistantId", u.email::text as email, u.phone,
        u.password_hash as "passwordHash", coalesce(u.metadata, '{}'::jsonb) as metadata
      from zigo.users u
      join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false and coalesce(ur.is_active, true) = true
      join zigo.roles r on r.id = ur.role_id and r.code = 'assistant'
      left join zigo.assistants a on a.user_id = u.id
      where u.deleted_at is null
        and (
          ($1::text <> '' and regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g') = $1::text)
          or ($2::text <> '' and lower(coalesce(u.email::text, '')) = lower($2::text))
          or ($3::text <> '' and lower(coalesce(a.assistant_code, '')) = lower($3::text))
        )
      order by u.created_at desc
      limit 1
    `,
    [normalized.phoneDigits, normalized.email, normalized.raw]
  );
  return result.rows[0] ?? null;
}

async function assertPortalEmailAvailableGlobally(client: Queryable, email: string, excludeUserId?: string | null) {
  const conflict = await client.query<{ id: string }>(
    `
      select id
      from zigo.users
      where deleted_at is null
        and lower(coalesce(email::text, '')) = lower($1::text)
        and ($2::uuid is null or id <> $2::uuid)
      limit 1
    `,
    [email.trim().toLowerCase(), excludeUserId ?? null]
  );
  if (conflict.rows[0]) throw new HttpError(409, "Email already exists with another user. Please use another email.");
}

async function findAssistantForPasswordReset(client: Queryable, email: string) {
  const result = await client.query<{
    userId: string;
    assistantId: string | null;
    email: string | null;
    passwordHash: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `
      select u.id as "userId", a.id as "assistantId", u.email::text as email,
        u.password_hash as "passwordHash", coalesce(u.metadata, '{}'::jsonb) as metadata
      from zigo.users u
      join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false and coalesce(ur.is_active, true) = true
      join zigo.roles r on r.id = ur.role_id and r.code = 'assistant'
      left join zigo.assistants a on a.user_id = u.id
      where u.deleted_at is null
        and lower(coalesce(u.email::text, '')) = lower($1::text)
      order by u.created_at desc
      limit 1
    `,
    [email.trim().toLowerCase()]
  );
  return result.rows[0] ?? null;
}

async function createCustomerPortalUser(client: Queryable, input: { phone: string; displayName?: string | null }) {
  const roleId = await roleIdByCode(client, "customer");
  if (!roleId) throw new HttpError(500, "Customer role is not configured.");
  const phone = normalizePhone(input.phone);
  const user = await client.query<{ id: string }>(
    `
      insert into zigo.users (phone, display_name, metadata)
      values ($1, $2, jsonb_build_object(
        'accountStatus', 'inactive',
        'isLoginWithOtp', true,
        'isLoginWithPassword', false,
        'createdFrom', 'customer_portal'
      ))
      returning id
    `,
    [phone, input.displayName || "Customer"]
  );
  await client.query(
    "insert into zigo.user_roles (user_id, role_id, is_primary) values ($1, $2, true)",
    [user.rows[0].id, roleId]
  );
  const customer = await client.query<{ id: string }>(
    `
      insert into zigo.customers (user_id, customer_code)
      values ($1::uuid, 'CUS-' || upper(replace($1::text, '-', '')))
      on conflict (user_id) do update set updated_at = now()
      returning id
    `,
    [user.rows[0].id]
  );
  return { userId: user.rows[0].id, customerId: customer.rows[0].id, assistantId: null };
}

async function ensureCustomerPortalIdentity(client: Queryable, input: { phone: string; displayName?: string | null }) {
  const existing = await findAnyUserByPhone(client, input.phone);
  if (!existing) return createCustomerPortalUser(client, input);
  const roleId = await roleIdByCode(client, "customer");
  if (!roleId) throw new HttpError(500, "Customer role is not configured.");
  await client.query(
    `
      insert into zigo.user_roles (user_id, role_id, is_primary, is_active)
      select $1, $2, false, true
      where not exists (
        select 1
        from zigo.user_roles
        where user_id = $1
          and role_id = $2
          and coalesce(is_deleted, false) = false
      )
    `,
    [existing.userId, roleId]
  );
  const customer = await client.query<{ id: string }>(
    `
      insert into zigo.customers (user_id, customer_code)
      values ($1::uuid, 'CUS-' || upper(replace($1::text, '-', '')))
      on conflict (user_id) do update set updated_at = now()
      returning id
    `,
    [existing.userId]
  );
  if (input.displayName?.trim()) {
    await client.query(
      `
        update zigo.users
        set display_name = coalesce(nullif(display_name, ''), $2),
            updated_at = now()
        where id = $1 and deleted_at is null
      `,
      [existing.userId, input.displayName.trim()]
    );
  }
  return { ...existing, customerId: customer.rows[0].id };
}

function portalToken(input: { userId: string; actor: PortalActor }) {
  return jwt.sign({ sub: input.userId, app: `${input.actor}_portal`, roles: [input.actor] }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyPortalToken(token: string, actor?: PortalActor) {
  const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; app: string; roles?: string[] };
  const tokenActor = payload.app === "customer_portal" ? "customer" : payload.app === "assistant_portal" ? "assistant" : null;
  if (!tokenActor || (actor && tokenActor !== actor)) throw new HttpError(403, "Portal token required.");
  return { userId: payload.sub, actor: tokenActor as PortalActor };
}

export async function getPortalConfig() {
  const settings = await getBookingEngineSetting();
  return {
    bookingEngine: {
      customerCancelInstantMinutes: settings.customerCancelInstantMinutes,
      customerCancelScheduleMinutes: settings.customerCancelScheduleMinutes
    },
    customerPortal: settings.customerPortal,
    assistantPortal: settings.assistantPortal,
    adminOverride: settings.adminOverride,
    communication: settings.communication
  };
}

export async function requestPortalCode(input: { actor: PortalActor; phone: string; displayName?: string | null }) {
  const settings = await getBookingEngineSetting();
  const portal = input.actor === "customer" ? settings.customerPortal : settings.assistantPortal;
  if (!portal.isEnabled) throw new HttpError(403, `${input.actor === "customer" ? "Customer" : "Assistant"} portal is disabled.`);
  if (!portal.loginWithMobileOtp) throw new HttpError(403, "Mobile verification code login is disabled.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    let identity = await findPortalUserByPhone(client, input.actor, input.phone);
    if (!identity && input.actor === "customer") {
      if (!settings.customerPortal.allowSelfRegistration) throw new HttpError(404, "Customer registration is disabled.");
      identity = await ensureCustomerPortalIdentity(client, input);
    }
    if (!identity) throw new HttpError(404, input.actor === "assistant" ? "Assistant not found for this mobile number." : "Customer not found.");
    await client.query("commit");
    const sent = await sendUserOtpChallenge({ userId: identity.userId, channels: ["mobile"], actorUserId: identity.userId });
    return { userId: identity.userId, sentChannels: sent.sentChannels, deliveries: sent.deliveries, sendWarning: sent.sendWarning };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPortalCode(input: { actor: PortalActor; phone: string; code: string }) {
  const identity = await findPortalUserByPhone(pool, input.actor, input.phone);
  if (!identity) throw new HttpError(404, "Account not found.");
  await verifyUserOtpChallenge({ userId: identity.userId, otps: { mobile: input.code }, actorUserId: identity.userId });
  const user = await getUserById(identity.userId);
  return {
    token: portalToken({ userId: identity.userId, actor: input.actor }),
    actor: input.actor,
    user,
    customerId: identity.customerId,
    assistantId: identity.assistantId
  };
}

export async function loginAssistantPortalWithPassword(input: { identifier: string; password: string }) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled) throw new HttpError(403, "Assistant portal is disabled.");
  if (!settings.assistantPortal.loginWithPassword) throw new HttpError(403, "Assistant password login is disabled.");
  const identity = await findAssistantForPasswordLogin(pool, input.identifier);
  if (!identity) throw new HttpError(401, "Invalid assistant login details.");
  if (!accountCanUsePortal(identity.metadata)) throw new HttpError(403, "Assistant account is deactive. Contact admin.");
  if (!passwordLoginAllowed(identity.metadata, Boolean(identity.passwordHash))) throw new HttpError(403, "Password login is not enabled for this assistant.");
  if (!identity.passwordHash) throw new HttpError(400, "Password is not set. Use email verification code to set your password.");
  const matched = await bcrypt.compare(input.password, identity.passwordHash);
  if (!matched) throw new HttpError(401, "Invalid assistant login details.");
  await pool.query("update zigo.users set last_login_at = now(), updated_at = now() where id = $1 and deleted_at is null", [identity.userId]);
  const user = await getUserById(identity.userId);
  return {
    token: portalToken({ userId: identity.userId, actor: "assistant" }),
    actor: "assistant" as const,
    user,
    assistantId: identity.assistantId
  };
}

export async function sendAssistantPasswordResetCode(input: { email: string; identifier?: string }) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled) throw new HttpError(403, "Assistant portal is disabled.");
  if (!settings.assistantPortal.loginWithPassword) throw new HttpError(403, "Assistant password login is disabled.");
  const email = input.email.trim().toLowerCase();
  let identity = await findAssistantForPasswordReset(pool, email);
  if (!identity && input.identifier?.trim()) {
    identity = await findAssistantForPasswordLogin(pool, input.identifier.trim());
  }
  if (!identity) throw new HttpError(404, "Assistant not found. Enter registered mobile number or assistant ID to set this email.");
  if (!accountCanUsePortal(identity.metadata)) throw new HttpError(403, "Assistant account is deactive. Contact admin.");
  if (identity.email && identity.email.toLowerCase() !== email) {
    throw new HttpError(409, "This assistant already has another email. Contact admin to change it.");
  }
  await assertPortalEmailAvailableGlobally(pool, email, identity.userId);
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const challenge = {
    codeHash: await bcrypt.hash(code, 10),
    email,
    expiresAt,
    sentAt: new Date().toISOString()
  };
  await pool.query(
    `
      update zigo.users
      set email = coalesce(email, $3),
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'assistantPasswordResetChallenge', $2::jsonb,
              'assistantPasswordResetStatus', 'pending',
              'assistantPasswordResetEmailSaved', (email is null),
              'assistantPasswordResetSentAt', now()::text
            ),
          updated_by = $1,
          updated_at = now()
      where id = $1 and deleted_at is null
    `,
    [identity.userId, JSON.stringify(challenge), email]
  );
  const delivery = await sendEmailOtp(email, code);
  if ((delivery as { skipped?: boolean; status?: string }).skipped || (delivery as { status?: string }).status === "failed") {
    throw new HttpError(502, `Unable to send password reset verification code. ${(delivery as { reason?: string }).reason || "Check email settings."}`);
  }
  return { email, expiresAt, delivery };
}

export async function verifyAssistantPasswordResetCode(input: { email: string; code: string; password: string; identifier?: string }) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled) throw new HttpError(403, "Assistant portal is disabled.");
  if (!settings.assistantPortal.loginWithPassword) throw new HttpError(403, "Assistant password login is disabled.");
  const email = input.email.trim().toLowerCase();
  let identity = await findAssistantForPasswordReset(pool, email);
  if (!identity && input.identifier?.trim()) {
    identity = await findAssistantForPasswordLogin(pool, input.identifier.trim());
  }
  if (!identity?.email) throw new HttpError(404, "Assistant email not found.");
  if (!accountCanUsePortal(identity.metadata)) throw new HttpError(403, "Assistant account is deactive. Contact admin.");
  const challenge = (identity.metadata?.assistantPasswordResetChallenge || {}) as { codeHash?: string; email?: string; expiresAt?: string };
  if (!challenge.codeHash || !challenge.expiresAt) throw new HttpError(400, "Password reset verification code is not pending.");
  if (String(challenge.email || "").toLowerCase() !== email) throw new HttpError(400, "Password reset email does not match.");
  if (new Date(challenge.expiresAt).getTime() < Date.now()) throw new HttpError(400, "Password reset verification code expired. Send code again.");
  const matched = await bcrypt.compare(input.code, challenge.codeHash);
  if (!matched) throw new HttpError(400, "Invalid password reset verification code.");
  const passwordHash = await bcrypt.hash(input.password, 12);
  await pool.query(
    `
      update zigo.users
      set password_hash = $2,
          last_login_at = now(),
          metadata = (coalesce(metadata, '{}'::jsonb) - 'assistantPasswordResetChallenge')
            || jsonb_build_object(
              'isLoginWithPassword', true,
              'assistantPasswordResetStatus', 'verified',
              'assistantPasswordResetVerifiedAt', now()::text,
              'passwordResetAt', now()::text,
              'passwordResetSource', 'assistant_portal'
            ),
          updated_by = $1,
          updated_at = now()
      where id = $1 and deleted_at is null
    `,
    [identity.userId, passwordHash]
  );
  const user = await getUserById(identity.userId);
  return {
    token: portalToken({ userId: identity.userId, actor: "assistant" }),
    actor: "assistant" as const,
    user,
    assistantId: identity.assistantId
  };
}

export async function getPortalMe(input: { userId: string; actor: PortalActor }) {
  await ensurePortalSchema();
  const identity = await pool.query<{ customerId: string | null; assistantId: string | null }>(
    `
      select c.id as "customerId", a.id as "assistantId"
      from zigo.users u
      left join zigo.customers c on c.user_id = u.id
      left join zigo.assistants a on a.user_id = u.id
      where u.id = $1 and u.deleted_at is null
      limit 1
    `,
    [input.userId]
  );
  const cart = input.actor === "customer" && identity.rows[0]?.customerId
    ? await getCustomerPortalCart(input.userId)
    : [];
  const favorites = input.actor === "customer" && identity.rows[0]?.customerId
    ? await getCustomerPortalFavorites(input.userId)
    : normalizePortalFavorites();
  return {
    actor: input.actor,
    user: await getUserById(input.userId),
    customerId: identity.rows[0]?.customerId ?? null,
    assistantId: identity.rows[0]?.assistantId ?? null,
    cart,
    favorites
  };
}

export async function getCustomerPortalFavorites(userId: string) {
  await ensurePortalSchema();
  await requireCustomerPortalCustomerId(userId);
  const result = await pool.query<{ favoriteType: string; objectId: string }>(
    `
      select favorite_type as "favoriteType", object_id as "objectId"
      from zigo.portal_favorites
      where user_id = $1 and actor_type = 'customer'
      order by created_at desc
    `,
    [userId]
  );
  const favorites = normalizePortalFavorites();
  for (const row of result.rows) {
    const type = String(row.favoriteType || "") as keyof PortalFavorites;
    if (type === "services" || type === "categories" || type === "stores") favorites[type].push(String(row.objectId || ""));
  }
  return normalizePortalFavorites(favorites);
}

export async function saveCustomerPortalFavorites(userId: string, input: Partial<PortalFavorites> = {}) {
  await ensurePortalSchema();
  await requireCustomerPortalCustomerId(userId);
  const favorites = normalizePortalFavorites(input);
  const rows = (Object.entries(favorites) as Array<[keyof PortalFavorites, string[]]>)
    .flatMap(([type, ids]) => ids.map((id) => ({ type, id })));
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from zigo.portal_favorites where user_id = $1 and actor_type = 'customer'", [userId]);
    if (rows.length) {
      const values: unknown[] = [userId];
      const tuples = rows.map((row, index) => {
        values.push(row.type, row.id);
        const typeParam = index * 2 + 2;
        const idParam = index * 2 + 3;
        return `($1::uuid, 'customer', $${typeParam}::text, $${idParam}::text)`;
      });
      await client.query(
        `
          insert into zigo.portal_favorites (user_id, actor_type, favorite_type, object_id)
          values ${tuples.join(", ")}
          on conflict (user_id, actor_type, favorite_type, object_id) do nothing
        `,
        values
      );
    }
    await client.query("commit");
    return favorites;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCustomerPortalCart(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  await ensurePortalSchema();
  const result = await pool.query<{ cartItems: unknown[]; customerNote: string }>(
    `
      select coalesce(cart_items, '[]'::jsonb) as "cartItems", coalesce(customer_note, '') as "customerNote"
      from zigo.customer_cart
      where customer_id = $1
      limit 1
    `,
    [customerId]
  );
  return {
    cartItems: Array.isArray(result.rows[0]?.cartItems) ? result.rows[0]!.cartItems : [],
    customerNote: String(result.rows[0]?.customerNote || "")
  };
}

export async function saveCustomerPortalCart(userId: string, input: { cartItems?: unknown[]; customerNote?: string } = {}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  await ensurePortalSchema();
  const items = Array.isArray(input.cartItems) ? input.cartItems : [];
  const note = String(input.customerNote || "");
  if (!items.length && !note.trim()) {
    await pool.query("delete from zigo.customer_cart where customer_id = $1", [customerId]);
    return { cartItems: [], customerNote: "" };
  }
  const result = await pool.query<{ cartItems: unknown[]; customerNote: string }>(
    `
      insert into zigo.customer_cart (customer_id, user_id, cart_items, customer_note, created_at, updated_at)
      values ($1, $2, $3::jsonb, $4, now(), now())
      on conflict (customer_id) do update
        set user_id = excluded.user_id,
            cart_items = excluded.cart_items,
            customer_note = excluded.customer_note,
            updated_at = now()
      returning coalesce(cart_items, '[]'::jsonb) as "cartItems", coalesce(customer_note, '') as "customerNote"
    `,
    [customerId, userId, JSON.stringify(items), note]
  );
  return {
    cartItems: Array.isArray(result.rows[0]?.cartItems) ? result.rows[0]!.cartItems : items,
    customerNote: String(result.rows[0]?.customerNote || note)
  };
}

function portalCartRecord(item: unknown): Record<string, unknown> | null {
  return item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
}

function portalCartText(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return value == null ? "" : String(value);
}

function portalCartItemId(item: Record<string, unknown>) {
  return portalCartText(item, "id")
    || portalCartText(item, "storeId")
    || portalCartText(item, "categoryId")
    || portalCartText(item, "sourceCategoryId");
}

function portalCartCategoryKey(item: Record<string, unknown>) {
  return portalCartText(item, "sourceCategoryId") || portalCartText(item, "categoryId");
}

function portalCartIsCategorySlot(item: Record<string, unknown>) {
  const itemType = portalCartText(item, "itemType").toLowerCase();
  const priceType = portalCartText(item, "priceType").toLowerCase();
  const hasDurationPrice = Boolean(portalCartText(item, "categoryPriceRuleId") || portalCartText(item, "durationLabel"));
  return !portalCartText(item, "storeId")
    && Boolean(portalCartCategoryKey(item))
    && (itemType === "time" || priceType === "time" || hasDurationPrice);
}

function portalCartSameItem(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftStoreId = portalCartText(left, "storeId");
  const rightStoreId = portalCartText(right, "storeId");
  if (leftStoreId && rightStoreId) return leftStoreId === rightStoreId;
  const leftId = portalCartItemId(left);
  const rightId = portalCartItemId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

export async function addCustomerPortalCartItem(userId: string, input: {
  item: Record<string, unknown>;
  customerNote?: string;
  replaceCart?: boolean;
}) {
  const current = await getCustomerPortalCart(userId);
  const incoming = portalCartRecord(input.item);
  if (!incoming) throw new HttpError(400, "Cart item is required.");
  const incomingIsCategorySlot = portalCartIsCategorySlot(incoming);
  const currentItems = input.replaceCart ? [] : current.cartItems;
  const nextItems = currentItems
    .map(portalCartRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => {
      if (portalCartSameItem(item, incoming)) return false;
      if (incomingIsCategorySlot && portalCartIsCategorySlot(item)) return false;
      return true;
    });
  nextItems.push(incoming);
  return saveCustomerPortalCart(userId, {
    cartItems: nextItems,
    customerNote: input.customerNote ?? current.customerNote
  });
}

export async function deleteCustomerPortalCartItem(userId: string, input: {
  id?: string | null;
  categoryId?: string | null;
  storeId?: string | null;
  index?: number | null;
}) {
  const current = await getCustomerPortalCart(userId);
  const index = Number.isInteger(input.index) ? Number(input.index) : -1;
  const nextItems = current.cartItems.filter((item, itemIndex) => {
    const row = portalCartRecord(item);
    if (!row) return false;
    if (input.storeId && portalCartText(row, "storeId") === String(input.storeId)) return false;
    if (input.categoryId && portalCartText(row, "categoryId") === String(input.categoryId) && !portalCartText(row, "storeId")) return false;
    if (input.id && portalCartItemId(row) === String(input.id)) return false;
    if (index >= 0 && itemIndex === index) return false;
    return true;
  });
  return saveCustomerPortalCart(userId, {
    cartItems: nextItems,
    customerNote: nextItems.length ? current.customerNote : ""
  });
}

export async function clearCustomerPortalCart(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  await ensurePortalSchema();
  await pool.query("delete from zigo.customer_cart where customer_id = $1", [customerId]);
  return [];
}

function portalBookingText(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return value == null ? "" : String(value).trim();
}

function portalBookingNumber(source: Record<string, unknown> | null | undefined, key: string, fallback = 0) {
  const value = Number(source?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function portalBookingMoneyPaise(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(numberValue * 100));
}

function portalBookingRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function listCustomerPortalBookings(userId: string, input: { tab?: string; page?: number; pageSize?: number } = {}) {
  await ensurePortalSchema();
  await completeExpiredFinishConfirmations(pool);
  await autoCancelExpiredUnstartedTasks(pool);
  const tab = String(input.tab || "all").toLowerCase();
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(input.pageSize || 10)));
  const offset = (page - 1) * pageSize;
  const tabClause = tab === "all" ? "" :
    tab === "working" ? `
          and lower(coalesce(sr.status_code, '')) in ('working', 'in_progress', 'on_the_way')
        ` :
    tab === "assigned" ? `
          and lower(coalesce(sr.status_code, '')) in ('assigned', 'accepted', 'processing', 'pending', 'hold')
          and not (sr.scheduled_at is not null and sr.scheduled_at > now())
        ` :
    tab === "upcoming" ? `
          and sr.scheduled_at is not null
          and sr.scheduled_at > now()
          and lower(coalesce(sr.status_code, '')) not in ('completed', 'success', 'paid', 'done', 'cancelled', 'canceled', 'failed', 'rejected')
        ` :
    tab === "completed" ? `
          and lower(coalesce(sr.status_code, '')) in ('completed', 'success', 'paid', 'done')
        ` :
    tab === "cancelled" ? `
          and lower(coalesce(sr.status_code, '')) in ('rejected', 'cancelled', 'canceled', 'failed', 'expired')
        ` : "";
  const result = await pool.query(
    `
      with bookings as (
        select
          sr.id,
          sr.request_number as "requestNumber",
          sr.booking_type as "bookingType",
          sr.booking_date as "bookingDate",
          sr.booking_time_slot as "bookingTimeSlot",
          sr.status_code as "statusCode",
          sr.notes,
          sr.duration_minutes as "durationMinutes",
          sr.waiting_time_minutes as "waitingTimeMinutes",
          sr.waiting_charges_paise as "waitingChargesPaise",
          sr.base_price_paise as "basePricePaise",
          sr.selling_price_paise as "sellingPricePaise",
          coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise",
          coalesce(sr.discount_paise, 0) as "discountPaise",
          sr.estimated_amount_paise as "estimatedAmountPaise",
          sr.payment_type as "paymentType",
          sr.payment_status as "paymentStatus",
          sr.is_paid as "isPaid",
          sr.service_id as "serviceId",
          sr.category_id as "categoryId",
          sr.service_details as "serviceDetails",
          sr.category_details as "categoryDetails",
          sr.store_details as "storeDetails",
          sr.location_details as "locationDetails",
          sr.upload_details as "uploadDetails",
          sr.metadata,
          sr.payment_details as "paymentDetails",
          sr.created_at as "createdAt",
          sr.scheduled_at as "scheduledAt",
          coalesce(sr.scheduled_at, sr.created_at) as "sortAt",
          sr.accepted_assignment_id as "assignmentId",
          ta.assistant_id as "assistantId",
          au.display_name as "assistantName",
          au.phone as "assistantPhone",
          coalesce(profile_doc.preview_url, au.metadata->>'profilePictureUrl') as "assistantProfilePictureUrl",
          s.name as "serviceName",
          c.name as "clusterName",
          coalesce(
            json_agg(jsonb_build_object('address', rl.address, 'latitude', rl.latitude, 'longitude', rl.longitude) order by rl.sequence)
              filter (where rl.id is not null),
            '[]'::json
          ) as locations
        from zigo.customers cu
        join zigo.service_requests sr on sr.customer_id = cu.id
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        left join zigo.assistants aa on aa.id = ta.assistant_id
        left join zigo.users au on au.id = aa.user_id
        left join lateral (
          select f.object_key as preview_url
          from zigo.assistant_documents ad
          left join zigo.document_types dt on dt.id = ad.document_type_id
          left join zigo.files f on f.id = ad.file_id
          where ad.assistant_id = aa.id and dt.code in ('profile_picture', 'profile_photo')
          order by ad.created_at desc
          limit 1
        ) profile_doc on true
        left join zigo.services s on s.id = sr.service_id
        left join zigo.clusters c on c.id = sr.cluster_id
        left join zigo.request_locations rl on rl.service_request_id = sr.id
        where cu.user_id = $1
        ${tabClause}
        group by sr.id, ta.assistant_id, au.display_name, au.phone, au.metadata, profile_doc.preview_url, s.name, c.name, sr.scheduled_at, sr.created_at
      )
      select *, count(*) over()::int as "totalRecords"
      from bookings
      order by "sortAt" desc, id desc
      limit $2 offset $3
    `,
    [userId, pageSize, offset]
  );
  const updates = await taskUpdatesByBookingIds(pool, result.rows.map((row) => row.id), { userId, actor: "customer" });
  const totalRecords = Number(result.rows[0]?.totalRecords || 0);
  return {
    data: result.rows.map((row) => {
      const { totalRecords: _totalRecords, ...booking } = row;
      return { ...booking, taskUpdates: updates.get(row.id) || [] };
    }),
    pagination: {
      page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
      hasMore: page * pageSize < totalRecords
    }
  };
}

export async function getCustomerPortalCatalog(filters: {
  clusterId?: string;
  serviceId?: string;
  categoryId?: string;
  q?: string;
} = {}) {
  if (filters.clusterId) {
    return getBookingCatalog({
      clusterId: filters.clusterId,
      serviceId: filters.serviceId,
      categoryId: filters.categoryId,
      q: filters.q
    });
  }

  const [clusters, services, categories, masterCategories, stores] = await Promise.all([
    pool.query(
      `
        select id, name, code
        from zigo.clusters
        where coalesce(is_deleted, false) = false
          and coalesce(is_booking_enabled, true) = true
        order by name
        limit 25
      `
    ),
    pool.query(
      `
        select
          s.id,
          s.code,
          s.name,
          s.description,
          s.image_url as "imageUrl",
          coalesce(s.metadata->'pricing'->>'priceType', 'task') as "priceType",
          coalesce(nullif(s.metadata->'bookingLocation'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
          s.priority,
          s.sort_order as "sortOrder",
          coalesce((
            select array_agg(distinct m.cluster_id)
            from zigo.cluster_service_settings m
            where m.service_id = s.id
              and coalesce(m.is_deleted, false) = false
              and coalesce(m.is_active, true) = true
              and coalesce(m.is_visible, true) = true
              and coalesce(m.is_enabled, true) = true
          ), '{}'::uuid[]) as "clusterIds"
        from zigo.services s
        where coalesce(s.is_deleted, false) = false
          and coalesce(s.is_active, true) = true
          and coalesce(s.is_enabled, true) = true
        order by s.priority, s.sort_order, s.name
        limit 40
      `
    ),
    pool.query(
      `
        select
          c.id,
          c.service_id as "serviceId",
          c.parent_category_id as "parentCategoryId",
          c.code,
          c.name,
          c.description,
          c.image_url as "imageUrl",
          coalesce((c.config->'pricing'->>'basePrice')::numeric, 0) as "basePrice",
          coalesce((c.config->'pricing'->>'sellingPrice')::numeric, 0) as "sellingPrice",
          coalesce(nullif(c.config->'allottedTime'->>'durationMinutes', '')::int, 30) as "durationMinutes",
          c.priority,
          c.sort_order as "sortOrder",
          coalesce((
            select array_agg(distinct mapped.cluster_id)
            from (
              select m.cluster_id
              from zigo.cluster_category_settings m
              where m.category_id = c.id
                and coalesce(m.is_deleted, false) = false
                and coalesce(m.is_active, true) = true
                and coalesce(m.is_visible, true) = true
                and coalesce(m.is_enabled, true) = true
              union
              select m.cluster_id
              from zigo.cluster_service_settings m
              where m.service_id = c.service_id
                and coalesce(m.is_deleted, false) = false
                and coalesce(m.is_active, true) = true
                and coalesce(m.is_visible, true) = true
                and coalesce(m.is_enabled, true) = true
            ) mapped
          ), '{}'::uuid[]) as "clusterIds"
        from zigo.categories c
        left join zigo.services s on s.id = c.service_id
        where coalesce(c.is_deleted, false) = false
          and coalesce(c.is_active, true) = true
          and coalesce(c.is_enabled, true) = true
          and coalesce(s.is_deleted, false) = false
          and coalesce(s.is_active, true) = true
          and coalesce(s.is_enabled, true) = true
        order by c.priority, c.sort_order, c.name
        limit 160
      `
    ),
    pool.query(
      `
        select
          c.id,
          c.code,
          c.name,
          c.description,
          c.image_url as "imageUrl",
          c.priority,
          c.sort_order as "sortOrder",
          c.is_recommended as "isRecommended",
          c.config->'categorySettings'->>'note' as "note",
          coalesce(c.config->'categorySettings'->>'locationMode', 'current') as "locationMode",
          coalesce(nullif(c.config->'categorySettings'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
          coalesce((c.config->'categorySettings'->>'addWithOtherCategory')::boolean, false) as "addWithOtherCategory",
          coalesce(c.config->'categoryGuidance'->>'taskListTitle', 'Tasks related to category') as "taskListTitle",
          coalesce(c.config->'categoryGuidance'->'taskList', '[]'::jsonb) as "taskList",
          coalesce(c.config->'categoryGuidance'->>'canDoTitle', 'What Assistant can do') as "canDoTitle",
          coalesce(c.config->'categoryGuidance'->'canDoList', '[]'::jsonb) as "canDoList",
          coalesce(c.config->'categoryGuidance'->>'cantDoTitle', 'What Assistant can''t do') as "cantDoTitle",
          coalesce(c.config->'categoryGuidance'->'cantDoList', '[]'::jsonb) as "cantDoList",
          c.is_active as "isActive",
          c.is_enabled as "isEnabled"
        from zigo.categories c
        where coalesce(c.is_deleted, false) = false
          and c.service_id is null
          and c.parent_category_id is null
          and coalesce(c.is_active, true) = true
          and coalesce(c.is_enabled, true) = true
        order by c.priority, c.sort_order, c.name
        limit 160
      `
    ),
    pool.query(
      `
        select
          st.id,
          st.code,
          st.name,
          st.description,
          st.address,
          st.contact,
          st.website,
          st.latitude,
          st.longitude,
          st.priority,
          st.operating_hours as "operatingHours",
          st.is_active as "isActive",
          (
            select si.image_url
            from zigo.store_images si
            where si.store_id = st.id
              and coalesce(si.is_deleted, false) = false
              and coalesce(si.is_active, true) = true
            order by si.is_primary desc, si.priority, si.created_at
            limit 1
          ) as "primaryImageUrl",
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', si.id,
              'imageUrl', si.image_url,
              'isPrimary', si.is_primary,
              'priority', si.priority
            ) order by si.is_primary desc, si.priority, si.created_at)
            from zigo.store_images si
            where si.store_id = st.id
              and coalesce(si.is_deleted, false) = false
              and coalesce(si.is_active, true) = true
          ), '[]'::jsonb) as images,
          coalesce((
            select array_agg(m.category_id)
            from zigo.category_store_map m
            where m.store_id = st.id
              and coalesce(m.is_deleted, false) = false
              and coalesce(m.is_active, true) = true
          ), '{}'::uuid[]) as "serviceCategoryIds",
          coalesce((
            select array_agg(distinct c.service_id)
            from zigo.category_store_map m
            join zigo.categories c on c.id = m.category_id
            where m.store_id = st.id
              and coalesce(m.is_deleted, false) = false
              and coalesce(m.is_active, true) = true
          ), '{}'::uuid[]) as "serviceIds",
          coalesce((
            select array_agg(distinct mapped.cluster_id)
            from (
              select csm.cluster_id
              from zigo.category_store_map m
              join zigo.categories c on c.id = m.category_id
              join zigo.cluster_service_settings csm on csm.service_id = c.service_id
              where m.store_id = st.id
                and coalesce(m.is_deleted, false) = false
                and coalesce(m.is_active, true) = true
                and coalesce(csm.is_deleted, false) = false
                and coalesce(csm.is_active, true) = true
                and coalesce(csm.is_visible, true) = true
                and coalesce(csm.is_enabled, true) = true
              union
              select ccsm.cluster_id
              from zigo.category_store_map m
              join zigo.cluster_category_settings ccsm on ccsm.category_id = m.category_id
              where m.store_id = st.id
                and coalesce(m.is_deleted, false) = false
                and coalesce(m.is_active, true) = true
                and coalesce(ccsm.is_deleted, false) = false
                and coalesce(ccsm.is_active, true) = true
                and coalesce(ccsm.is_visible, true) = true
                and coalesce(ccsm.is_enabled, true) = true
            ) mapped
          ), '{}'::uuid[]) as "clusterIds"
        from zigo.stores st
        where coalesce(st.is_deleted, false) = false
          and coalesce(st.is_active, true) = true
        order by st.priority, st.name
        limit 160
      `
    )
  ]);
  return {
    clusters: clusters.rows,
    services: services.rows,
    categories: categories.rows,
    masterCategories: masterCategories.rows,
    stores: stores.rows
  };
}

async function requireCustomerPortalCustomerId(userId: string) {
  const customer = await pool.query<{ id: string }>("select id from zigo.customers where user_id = $1 limit 1", [userId]);
  if (!customer.rows[0]) throw new HttpError(404, "Customer profile not found.");
  return customer.rows[0].id;
}

export async function searchCustomerPortalLocations(query: string) {
  return searchBookingLocations(query);
}

export async function reverseCustomerPortalLocation(input: { latitude: number; longitude: number }) {
  return reverseBookingLocation(input);
}

export async function validateCustomerPortalLocation(userId: string, input: {
  address?: string | null;
  latitude: number;
  longitude: number;
  addressId?: string | null;
  source?: string | null;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  return validateBookingLocation({ customerId, ...input });
}

export async function listCustomerPortalAddresses(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  return listAdminCustomerAddresses(customerId);
}

export async function saveCustomerPortalAddress(userId: string, input: {
  label?: string | null;
  customLabel?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string | null;
  personName?: string | null;
  contactNumber?: string | null;
  source?: string | null;
  isDefault?: boolean;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  const finalLabel = input.label === "Other" ? input.customLabel?.trim() : input.label?.trim();
  if (!finalLabel) throw new HttpError(400, "Enter address label name.");
  if (input.label === "Other" && ["home", "work", "other"].includes(finalLabel.toLowerCase())) {
    throw new HttpError(400, "This label is already used by default labels, try different.");
  }
  const serviceability = await validateBookingLocation({
    customerId,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source || "manual"
  });
  if (!serviceability.isServiceable || !serviceability.cluster?.clusterId) {
    throw new HttpError(400, serviceability.message || "Selected location is outside active working clusters.");
  }
  return createAdminCustomerAddress(customerId, {
    label: finalLabel,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    clusterId: serviceability.cluster.clusterId,
    isDefault: input.isDefault ?? false,
    metadata: {
      landmark: input.landmark || "",
      personName: input.personName || "",
      contactNumber: input.contactNumber || "",
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || "manual",
      serviceability
    },
    userId
  });
}

export async function createCustomerPortalBooking(userId: string, input: {
  serviceId?: string | null;
  clusterId: string;
  categoryId?: string | null;
  deliveryTypeId?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  estimatedAmountPaise?: number;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
}) {
  const settings = await getBookingEngineSetting();
  if (!settings.customerPortal.isEnabled || !settings.customerPortal.allowBookService) throw new HttpError(403, "Customer booking is disabled.");
  const customerId = await requireCustomerPortalCustomerId(userId);
  const metadata = { ...(input.metadata || {}) };
  const rawCartItems = Array.isArray(metadata.cartItems) ? metadata.cartItems : [];
  const selectedCartItem = rawCartItems
    .map(portalBookingRecord)
    .find((item) => item && portalBookingText(item, "categoryId") && !portalBookingText(item, "storeId"))
    || rawCartItems.map(portalBookingRecord).find(Boolean)
    || null;
  const selectedCategoryId = input.categoryId
    || portalBookingText(selectedCartItem, "categoryId")
    || portalBookingText(metadata, "categoryId")
    || null;
  const categoryResult = selectedCategoryId ? await pool.query<{
    id: string;
    name: string;
    code: string | null;
    imageUrl: string | null;
    serviceId: string | null;
    serviceName: string | null;
  }>(
    `
      select
        c.id,
        c.name,
        c.code,
        c.image_url as "imageUrl",
        coalesce(c.service_id, parent.service_id) as "serviceId",
        s.name as "serviceName"
      from zigo.categories c
      left join zigo.categories parent on parent.id = c.parent_category_id
      left join zigo.services s on s.id = coalesce(c.service_id, parent.service_id)
      where c.id = $1
      limit 1
    `,
    [selectedCategoryId]
  ) : { rows: [] as Array<{ id: string; name: string; code: string | null; imageUrl: string | null; serviceId: string | null; serviceName: string | null }> };
  const category = categoryResult.rows[0] || null;
  const selectedServiceId = input.serviceId
    || portalBookingText(selectedCartItem, "serviceId")
    || category?.serviceId
    || null;
  const categoryName = category?.name
    || portalBookingText(selectedCartItem, "categoryName")
    || portalBookingText(selectedCartItem, "name")
    || portalBookingText(metadata, "categoryName")
    || "Category";
  const serviceName = category?.serviceName
    || portalBookingText(selectedCartItem, "serviceName")
    || portalBookingText(metadata, "serviceName")
    || "Personal Assistant";
  const durationMinutes = Math.max(1, Math.min(1440, Math.round(
    portalBookingNumber(selectedCartItem, "durationMinutes", Number(input.durationMinutes || metadata.durationMinutes || 30))
  )));
  const selectedPrice = portalBookingNumber(selectedCartItem, "price",
    portalBookingNumber(selectedCartItem, "sellingPrice", Number(input.estimatedAmountPaise || metadata.paymentAmountPaise || 0) / 100)
  );
  const selectedBasePrice = portalBookingNumber(selectedCartItem, "basePrice", selectedPrice);
  const paymentAmountPaise = Math.max(
    0,
    Math.round(Number(input.estimatedAmountPaise || metadata.paymentAmountPaise || portalBookingMoneyPaise(selectedPrice)))
  );
  const categoryBookingItem = selectedCategoryId ? {
    id: portalBookingText(selectedCartItem, "id") || selectedCategoryId,
    itemType: "category",
    priceType: portalBookingText(selectedCartItem, "priceType") || "time",
    categoryId: selectedCategoryId,
    categoryName,
    categoryCode: category?.code || portalBookingText(selectedCartItem, "categoryCode") || "",
    serviceId: selectedServiceId,
    serviceName,
    name: portalBookingText(selectedCartItem, "name") || categoryName,
    imageUrl: portalBookingText(selectedCartItem, "imageUrl") || portalBookingText(selectedCartItem, "categoryImageUrl") || category?.imageUrl || "",
    categoryImageUrl: portalBookingText(selectedCartItem, "categoryImageUrl") || portalBookingText(selectedCartItem, "imageUrl") || category?.imageUrl || "",
    serviceImageUrl: portalBookingText(selectedCartItem, "serviceImageUrl"),
    durationMinutes,
    basePrice: selectedBasePrice,
    sellingPrice: selectedPrice,
    price: selectedPrice,
    saveAmount: Math.max(0, selectedBasePrice - selectedPrice),
    categoryPriceRuleId: portalBookingText(selectedCartItem, "categoryPriceRuleId") || null,
    durationLabel: portalBookingText(selectedCartItem, "durationLabel") || portalBookingText(selectedCartItem, "label"),
    allottedTime: portalBookingRecord(selectedCartItem?.allottedTime) || { enabled: true, durationMinutes },
    waitingCharge: portalBookingRecord(selectedCartItem?.waitingCharge) || { enabled: false, amount: 0, chargePerMinutes: 0 }
  } : selectedCartItem;
  const cleanCartItems = categoryBookingItem ? [categoryBookingItem] : [];
  const bookingType = String(metadata.bookingType || "instant") === "schedule" ? "schedule" : "instant";
  const booking = await createBookingByAdmin({
    ...input,
    serviceId: selectedServiceId,
    categoryId: selectedCategoryId,
    customerId,
    estimatedAmountPaise: paymentAmountPaise,
    durationMinutes,
    metadata: {
      ...metadata,
      cartItems: cleanCartItems,
      categoryBooking: categoryBookingItem,
      categoryId: selectedCategoryId,
      categoryName,
      serviceId: selectedServiceId,
      serviceName,
      durationMinutes,
      bookingAmountPaise: paymentAmountPaise,
      paymentAmountPaise,
      createdFrom: "customer_portal",
      cancelWindowMinutes: bookingType === "schedule" ? settings.customerCancelScheduleMinutes : settings.customerCancelInstantMinutes
    },
    actorUserId: userId
  });
  await clearCustomerPortalCart(userId);
  return booking;
}

export async function getCustomerPortalBookingAvailability(userId: string, input: {
  clusterId: string;
  locationClusterIds?: string[];
  serviceId?: string | null;
  categoryId?: string | null;
  durationMinutes?: number;
  waitWindowMinutes?: number;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const settings = await getBookingEngineSetting();
  if (!settings.customerPortal.isEnabled || !settings.customerPortal.allowBookService) throw new HttpError(403, "Customer booking is disabled.");
  await requireCustomerPortalCustomerId(userId);
  return getBookingAvailabilityDecision({
    clusterId: input.clusterId,
    locationClusterIds: input.locationClusterIds || [],
    serviceId: input.serviceId ?? null,
    categoryId: input.categoryId ?? null,
    durationMinutes: Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30)))),
    waitWindowMinutes: Math.max(0, Math.min(1440, Math.round(Number(input.waitWindowMinutes || 0)))),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null
  });
}

export async function cancelCustomerPortalBooking(userId: string, input: { bookingId: string; reason: string }) {
  const settings = await getBookingEngineSetting();
  if (!settings.customerPortal.isEnabled) throw new HttpError(403, "Customer portal is disabled.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensurePortalSchema(client);
    await ensureBookingEngineSchema(client);
    const booking = await client.query<{
      bookingId: string;
      assignmentId: string | null;
      assistantId: string | null;
      statusCode: string;
      metadata: Record<string, unknown> | null;
    }>(
      `
        select sr.id as "bookingId", sr.accepted_assignment_id as "assignmentId",
          ta.assistant_id as "assistantId", sr.status_code as "statusCode",
          coalesce(sr.metadata, '{}'::jsonb) as metadata
        from zigo.customers cu
        join zigo.service_requests sr on sr.customer_id = cu.id
        left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
        where cu.user_id = $1 and sr.id = $2
        for update of sr
      `,
      [userId, input.bookingId]
    );
    const row = booking.rows[0];
    if (!row) throw new HttpError(404, "Booking not found.");
    if (["completed", "cancelled", "canceled", "failed", "rejected"].includes(String(row.statusCode || "").toLowerCase())) {
      throw new HttpError(400, "This booking can no longer be cancelled.");
    }
    const reason = String(input.reason || "Cancelled by customer").trim();
    await client.query(
      `
        update zigo.service_requests
        set status_code = 'cancelled',
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        row.bookingId,
        JSON.stringify({
          cancelledBy: "customer",
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason
        })
      ]
    );
    await client.query(
      `
        update zigo.task_assignments
        set status_code = 'cancelled',
            responded_at = coalesce(responded_at, now()),
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where service_request_id = $1
          and status_code not in ('completed', 'cancelled', 'rejected')
      `,
      [
        row.bookingId,
        JSON.stringify({
          cancelledBy: "customer",
          cancellationReason: reason,
          cancelledAt: new Date().toISOString()
        })
      ]
    );
    await client.query(
      `
        update zigo.assistant_capacity_reservations
        set status_code = 'released',
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where service_request_id = $1
          and status_code in ('held', 'reserved', 'assigned')
      `,
      [
        row.bookingId,
        JSON.stringify({ releasedBy: "customer_cancel", cancellationReason: reason })
      ]
    );
    await client.query(
      `
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1, $2, $3, 'customer', 'status', $4, '[]'::jsonb, $5::jsonb)
      `,
      [
        row.bookingId,
        row.assignmentId,
        userId,
        `Booking cancelled. ${reason}`,
        JSON.stringify({ status: "cancelled", reason, cancelledAt: new Date().toISOString() })
      ]
    );
    await client.query("commit");
    return { bookingId: row.bookingId, assignmentId: row.assignmentId, assistantId: row.assistantId, status: "cancelled" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAssistantPortalTasks(userId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensurePortalSchema(client);
    await completeExpiredFinishConfirmations(client);
    await autoCancelExpiredUnstartedTasks(client);

    const result = await client.query(
      `
        select ta.id as "assignmentId", ta.status_code as "assignmentStatus", sr.id as "bookingId",
          sr.request_number as "requestNumber", sr.status_code as "bookingStatus", sr.notes,
          sr.duration_minutes as "durationMinutes", sr.estimated_amount_paise as "estimatedAmountPaise",
          sr.waiting_time_minutes as "waitingTimeMinutes", sr.waiting_charges_paise as "waitingChargesPaise",
          sr.metadata, coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
          sr.scheduled_at as "scheduledAt", sr.created_at as "createdAt",
          ta.expires_at as "assignmentExpiresAt",
          ta.offered_at as "assignmentOfferedAt", ta.assigned_at as "assignmentAssignedAt", ta.responded_at as "assignmentRespondedAt",
          u.display_name as "customerName", u.phone as "customerPhone",
          s.name as "serviceName", c.name as "clusterName",
          coalesce(json_agg(jsonb_build_object('address', rl.address, 'latitude', rl.latitude, 'longitude', rl.longitude) order by rl.sequence) filter (where rl.id is not null), '[]'::json) as locations
        from zigo.assistants a
        join zigo.task_assignments ta on ta.assistant_id = a.id
        join zigo.service_requests sr on sr.id = ta.service_request_id
        left join zigo.customers cu on cu.id = sr.customer_id
        left join zigo.users u on u.id = cu.user_id
        left join zigo.services s on s.id = sr.service_id
        left join zigo.clusters c on c.id = sr.cluster_id
        left join zigo.request_locations rl on rl.service_request_id = sr.id
        where a.user_id = $1
          and coalesce(ta.status_code, '') <> 'reassigned'
        group by ta.id, sr.id, u.display_name, u.phone, s.name, c.name
        order by
          case
            when sr.status_code in ('assigned', 'queued', 'paid', 'payment_pending') or ta.status_code in ('reserved', 'offered') then 1
            when sr.status_code in ('accepted', 'in_progress', 'approval_pending') or ta.status_code in ('accepted', 'in_progress') then 2
            when sr.status_code in ('hold', 'on_hold') then 3
            else 4
          end,
          sr.created_at desc
        limit 80
      `,
      [userId]
    );
    const updates = await taskUpdatesByBookingIds(client, result.rows.map((row) => row.bookingId), { userId, actor: "assistant" });
    await client.query("commit");
    return result.rows.map((row) => ({ ...row, taskUpdates: updates.get(row.bookingId) || [] }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setAssistantPortalOnline(userId: string, isOnline: boolean) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled || !settings.assistantPortal.allowGoOnline) throw new HttpError(403, "Assistant online control is disabled.");
  const assistant = await pool.query<{ id: string }>("select id from zigo.assistants where user_id = $1 limit 1", [userId]);
  if (!assistant.rows[0]) throw new HttpError(404, "Assistant profile not found.");
  return updateAssistantAvailability({ assistantId: assistant.rows[0].id, isOnline, actorUserId: userId });
}

export async function updateAssistantPortalTaskStatus(userId: string, input: { assignmentId: string; status: "accepted" | "in_progress" | "completed" | "rejected" }) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled || !settings.assistantPortal.allowTaskExecution) throw new HttpError(403, "Assistant task execution is disabled.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const assignment = await client.query<{
      bookingId: string;
      assistantId: string;
      customerUserId: string | null;
      durationMinutes: number | null;
      bookingStatus: string | null;
      assignmentStatus: string | null;
      bookingAmountPaise: number | null;
      waitingTimeMinutes: number | null;
      waitingChargesPaise: number | null;
      bookingMetadata: Record<string, any> | null;
      assignmentMetadata: Record<string, any> | null;
      assignmentRespondedAt: string | null;
    }>(
      `
        select sr.id as "bookingId", a.id as "assistantId", cu.user_id as "customerUserId",
          sr.duration_minutes as "durationMinutes", sr.status_code as "bookingStatus", ta.status_code as "assignmentStatus",
          sr.booking_amount_paise as "bookingAmountPaise", sr.waiting_time_minutes as "waitingTimeMinutes",
          sr.waiting_charges_paise as "waitingChargesPaise",
          coalesce(sr.metadata, '{}'::jsonb) as "bookingMetadata",
          coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
          ta.responded_at as "assignmentRespondedAt"
        from zigo.task_assignments ta
        join zigo.assistants a on a.id = ta.assistant_id
        join zigo.service_requests sr on sr.id = ta.service_request_id
        left join zigo.customers cu on cu.id = sr.customer_id
        where ta.id = $1 and a.user_id = $2
        limit 1
      `,
      [input.assignmentId, userId]
    );
    if (!assignment.rows[0]) throw new HttpError(404, "Task not found.");
    const current = assignment.rows[0];
    const now = new Date();
    if (input.status === "completed") {
      const existing = await client.query<{ id: string }>(
        `
          select id
          from zigo.booking_task_updates
          where service_request_id = $1
            and update_type = 'approval_request'
            and coalesce(metadata->>'purpose', '') = $2
            and coalesce(metadata->>'status', 'pending') = 'pending'
          order by created_at desc
          limit 1
        `,
        [current.bookingId, FINISH_CONFIRMATION_PURPOSE]
      );
      if (!existing.rows[0]) {
        const requestedAt = now;
        const confirmBy = new Date(requestedAt.getTime() + FINISH_CONFIRMATION_MINUTES * 60_000);
        const snapshot = finishTimerSnapshot(current, requestedAt);
        const finishMetadata = {
          purpose: FINISH_CONFIRMATION_PURPOSE,
          status: "pending",
          finishRequestedAt: requestedAt.toISOString(),
          timerHeldAt: requestedAt.toISOString(),
          confirmBy: confirmBy.toISOString(),
          responseDeadlineMinutes: FINISH_CONFIRMATION_MINUTES,
          startedAt: snapshot.startedAt,
          expectedFreeAt: snapshot.expectedFreeAt,
          taskTotalMinutes: snapshot.taskTotalMinutes,
          waitingMinutesAtRequest: snapshot.waitingMinutes,
          waitingChargesPaiseAtRequest: snapshot.waitingChargesPaise,
          waitingChargeAmountPaise: snapshot.waitingChargeAmountPaise,
          waitingChargePerMinutes: snapshot.waitingChargePerMinutes
        };
        await client.query(
          `
            update zigo.task_assignments
            set status_code = 'approval_pending',
                responded_at = coalesce(responded_at, now()),
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
            where id = $1
          `,
          [input.assignmentId, JSON.stringify({ finishConfirmationPending: true, finishRequestedAt: requestedAt.toISOString(), finishConfirmBy: confirmBy.toISOString(), timerHeldAt: requestedAt.toISOString(), taskTimer: { ...finishMetadata, status: "finish_confirmation_pending" } })]
        );
        await client.query(
          `
            update zigo.service_requests
            set status_code = 'approval_pending',
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
            where id = $1
          `,
          [current.bookingId, JSON.stringify({ finishConfirmationPending: true, finishRequestedAt: requestedAt.toISOString(), finishConfirmBy: confirmBy.toISOString(), timerHeldAt: requestedAt.toISOString(), timerStatus: "held", taskTimer: { ...finishMetadata, status: "finish_confirmation_pending" } })]
        );
        await client.query(
          `
            insert into zigo.booking_task_updates
              (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
            values ($1, $2, $3, 'assistant', 'approval_request', $4, '[]'::jsonb, $5::jsonb)
          `,
          [
            current.bookingId,
            input.assignmentId,
            userId,
            "Assistant wants to finish the task. Do you confirm?",
            JSON.stringify(finishMetadata)
          ]
        );
      }
      await client.query("commit");
      return {
        assignmentId: input.assignmentId,
        bookingId: current.bookingId,
        assistantId: current.assistantId,
        customerUserId: current.customerUserId,
        status: "approval_pending"
      };
    }
    const bookingStatus = input.status === "in_progress" ? "in_progress" : input.status === "rejected" ? "rejected" : "accepted";
    const statusMetadata = input.status === "in_progress"
      ? {
        startedAt: now.toISOString(),
        expectedFreeAt: new Date(now.getTime() + Math.max(1, Number(current.durationMinutes || 30)) * 60_000).toISOString(),
        timerStatus: "running",
        taskTimer: {
          status: "running",
          startedAt: now.toISOString(),
          expectedFreeAt: new Date(now.getTime() + Math.max(1, Number(current.durationMinutes || 30)) * 60_000).toISOString(),
          taskTotalMinutes: Math.max(1, Number(current.durationMinutes || 30))
        }
      }
      : {};
    await client.query(
      "update zigo.task_assignments set status_code = $2, responded_at = coalesce(responded_at, now()), metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb where id = $1",
      [input.assignmentId, input.status, JSON.stringify(statusMetadata)]
    );
    await client.query(
      `
        update zigo.service_requests
        set status_code = $2::text,
            accepted_assignment_id = case when $2::text = 'rejected' then null else accepted_assignment_id end,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        where id = $1
      `,
      [current.bookingId, bookingStatus, JSON.stringify(statusMetadata)]
    );
    await setAssistantAvailabilityForPortalTask(client, current.assistantId, input.status);
    if (input.status === "rejected") {
      await client.query(
        "update zigo.assistant_capacity_reservations set status_code = 'released', updated_at = now() where assignment_id = $1 and status_code in ('held', 'reserved', 'assigned')",
        [input.assignmentId]
      );
    }
    await client.query("commit");
    return {
      assignmentId: input.assignmentId,
      bookingId: current.bookingId,
      assistantId: current.assistantId,
      customerUserId: current.customerUserId,
      status: input.status
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createPortalTaskUpdate(input: {
  userId: string;
  actor: PortalActor;
  bookingId: string;
  assignmentId?: string | null;
  updateType: TaskUpdateType;
  message?: string | null;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}) {
  await ensurePortalSchema();
  const settings = await getBookingEngineSetting();
  if (!settings.communication.storeTaskMediaInTimeline) throw new HttpError(403, "Task timeline updates are disabled.");
  if (input.updateType === "text" && input.actor === "customer" && !settings.customerPortal.allowTextUpdates) throw new HttpError(403, "Customer text updates are disabled.");
  if (input.updateType === "image" && input.actor === "customer" && !settings.customerPortal.allowImageUpdates) throw new HttpError(403, "Customer image updates are disabled.");
  if (input.updateType === "video" && input.actor === "customer" && !settings.customerPortal.allowImageUpdates) throw new HttpError(403, "Customer video updates are disabled.");
  if (input.updateType === "voice" && input.actor === "customer" && !settings.customerPortal.allowVoiceUpdates) throw new HttpError(403, "Customer voice updates are disabled.");
  if (input.updateType === "text" && input.actor === "assistant" && !settings.assistantPortal.allowTextUpdates) throw new HttpError(403, "Assistant text updates are disabled.");
  if (input.updateType === "image" && input.actor === "assistant" && !settings.assistantPortal.allowImageUpdates) throw new HttpError(403, "Assistant image updates are disabled.");
  if (input.updateType === "video" && input.actor === "assistant" && !settings.assistantPortal.allowImageUpdates) throw new HttpError(403, "Assistant video updates are disabled.");
  if (input.updateType === "voice" && input.actor === "assistant" && !settings.assistantPortal.allowVoiceUpdates) throw new HttpError(403, "Assistant voice updates are disabled.");
  if (input.updateType === "file" && input.actor === "customer" && !settings.customerPortal.allowImageUpdates) throw new HttpError(403, "Customer file updates are disabled.");
  if (input.updateType === "file" && input.actor === "assistant" && !settings.assistantPortal.allowImageUpdates) throw new HttpError(403, "Assistant file updates are disabled.");
  if (["status", "location", "payment_request", "approval_request", "time_extension_request", "time_extension_approved"].includes(input.updateType) && input.actor === "assistant" && !settings.assistantPortal.allowTaskExecution) {
    throw new HttpError(403, "Assistant task execution is disabled.");
  }
  if (input.updateType === "approval_response" && input.actor === "customer" && !settings.customerPortal.allowTextUpdates) {
    throw new HttpError(403, "Customer approval updates are disabled.");
  }
  if (input.updateType === "payment_response" && input.actor === "customer" && !settings.customerPortal.allowTextUpdates) {
    throw new HttpError(403, "Customer payment updates are disabled.");
  }
  const relation = input.actor === "customer"
    ? await pool.query<{ customerUserId: string | null; assistantId: string | null }>(
      `
        select cu.user_id as "customerUserId", a.id as "assistantId"
        from zigo.customers cu
        join zigo.service_requests sr on sr.customer_id = cu.id
        left join zigo.task_assignments ta on ta.id = coalesce($3::uuid, sr.accepted_assignment_id)
        left join zigo.assistants a on a.id = ta.assistant_id
        where cu.user_id = $1 and sr.id = $2
        limit 1
      `,
      [input.userId, input.bookingId, input.assignmentId ?? null]
    )
    : await pool.query<{ customerUserId: string | null; assistantId: string | null }>(
      `
        select cu.user_id as "customerUserId", a.id as "assistantId"
        from zigo.assistants a
        join zigo.task_assignments ta on ta.assistant_id = a.id
        join zigo.service_requests sr on sr.id = ta.service_request_id
        left join zigo.customers cu on cu.id = sr.customer_id
        where a.user_id = $1 and sr.id = $2
          and ($3::uuid is null or ta.id = $3::uuid)
        limit 1
      `,
      [input.userId, input.bookingId, input.assignmentId ?? null]
    );
  if (!relation.rows[0]) throw new HttpError(403, "This booking is not linked with your account.");
  const result = await pool.query(
    `
      insert into zigo.booking_task_updates
        (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      returning id, created_at as "createdAt"
    `,
    [
      input.bookingId,
      input.assignmentId ?? null,
      input.userId,
      input.actor,
      input.updateType,
      input.message ?? null,
      JSON.stringify(input.mediaUrls || []),
      JSON.stringify(input.metadata || {})
    ]
  );
  if (input.updateType === "payment_response" && input.actor === "customer") {
    await pool.query(
      `
        update zigo.service_requests
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        input.bookingId,
        JSON.stringify({
          lastCustomerPaymentAt: new Date().toISOString(),
          lastCustomerPaymentAmount: Number((input.metadata || {}).amount || 0),
          lastCustomerPaymentStatus: "paid"
        })
      ]
    );
  }
  if (input.updateType === "approval_response" && input.actor === "customer") {
    const metadata = input.metadata || {};
    const response = String(metadata.response || "").toLowerCase() === "yes" ? "yes" : String(metadata.response || "").toLowerCase() === "no" ? "no" : "";
    const sourceUpdateId = String(metadata.sourceUpdateId || "");
    if (response && sourceUpdateId) {
      await handleFinishConfirmationResponse({
        userId: input.userId,
        sourceUpdateId,
        responseUpdateId: String(result.rows[0]?.id || ""),
        response
      });
    }
  }
  return { ...result.rows[0], ...relation.rows[0], bookingId: input.bookingId };
}

export async function approvePortalTimeExtension(userId: string, updateId: string) {
  await ensurePortalSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const requested = await client.query<{
      id: string;
      bookingId: string;
      assignmentId: string | null;
      assistantId: string | null;
      customerUserId: string | null;
      durationMinutes: number | null;
      requestMetadata: Record<string, unknown> | null;
      bookingMetadata: Record<string, unknown> | null;
    }>(
      `
        select btu.id, btu.service_request_id as "bookingId", btu.task_assignment_id as "assignmentId",
          a.id as "assistantId", cu.user_id as "customerUserId",
          sr.duration_minutes as "durationMinutes", coalesce(btu.metadata, '{}'::jsonb) as "requestMetadata",
          coalesce(sr.metadata, '{}'::jsonb) as "bookingMetadata"
        from zigo.booking_task_updates btu
        join zigo.service_requests sr on sr.id = btu.service_request_id
        join zigo.customers cu on cu.id = sr.customer_id
        left join zigo.task_assignments ta on ta.id = coalesce(btu.task_assignment_id, sr.accepted_assignment_id)
        left join zigo.assistants a on a.id = ta.assistant_id
        where btu.id = $1 and cu.user_id = $2 and btu.update_type = 'time_extension_request'
        for update of btu, sr
      `,
      [updateId, userId]
    );
    const row = requested.rows[0];
    if (!row) throw new HttpError(404, "Time extension request not found.");
    const metadata = row.requestMetadata || {};
    if (String(metadata.status || "").toLowerCase() === "approved") {
      await client.query("commit");
      return {
        id: row.id,
        bookingId: row.bookingId,
        assignmentId: row.assignmentId,
        assistantId: row.assistantId,
        customerUserId: row.customerUserId,
        requestedMinutes: Number(metadata.requestedMinutes || 0),
        extendedUntil: typeof metadata.extendedUntil === "string" ? metadata.extendedUntil : null,
        alreadyApproved: true
      };
    }
    const requestedMinutes = Math.max(5, Math.min(240, Math.round(Number(metadata.requestedMinutes || 15))));
    const bookingMetadata = row.bookingMetadata || {};
    const currentExpectedRaw = typeof bookingMetadata.expectedFreeAt === "string" ? bookingMetadata.expectedFreeAt : "";
    const currentExpected = currentExpectedRaw ? new Date(currentExpectedRaw) : null;
    const baseExpected = currentExpected && !Number.isNaN(currentExpected.getTime())
      ? currentExpected
      : new Date(Date.now() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
    const extendedUntil = new Date(Math.max(baseExpected.getTime(), Date.now()) + requestedMinutes * 60_000);

    await client.query(
      `
        update zigo.booking_task_updates
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [row.id, JSON.stringify({ status: "approved", approvedAt: new Date().toISOString(), approvedBy: userId, extendedUntil: extendedUntil.toISOString() })]
    );
    await client.query(
      `
        update zigo.service_requests
        set duration_minutes = coalesce(duration_minutes, 0) + $2::int,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        row.bookingId,
        requestedMinutes,
        JSON.stringify({
          expectedFreeAt: extendedUntil.toISOString(),
          lastTimeExtensionMinutes: requestedMinutes,
          lastTimeExtensionApprovedAt: new Date().toISOString()
        })
      ]
    );
    if (row.assignmentId) {
      await client.query(
        `
          update zigo.task_assignments
          set expires_at = $2::timestamptz,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where id = $1
        `,
        [
          row.assignmentId,
          extendedUntil.toISOString(),
          JSON.stringify({ expectedFreeAt: extendedUntil.toISOString(), lastTimeExtensionMinutes: requestedMinutes })
        ]
      );
      await client.query(
        `
          update zigo.assistant_capacity_reservations
          set reserved_until = $2::timestamptz,
              sla_deadline_at = greatest(coalesce(sla_deadline_at, $2::timestamptz), $2::timestamptz),
              updated_at = now(),
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where assignment_id = $1 and status_code in ('held', 'reserved', 'assigned')
        `,
        [
          row.assignmentId,
          extendedUntil.toISOString(),
          JSON.stringify({ extendedByCustomer: true, lastTimeExtensionMinutes: requestedMinutes })
        ]
      );
    }
    const approval = await client.query(
      `
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1, $2, $3, 'customer', 'time_extension_approved', $4, '[]'::jsonb, $5::jsonb)
        returning id, created_at as "createdAt"
      `,
      [
        row.bookingId,
        row.assignmentId,
        userId,
        `Extra ${requestedMinutes} mins approved.`,
        JSON.stringify({ requestedMinutes, extendedUntil: extendedUntil.toISOString(), sourceUpdateId: row.id })
      ]
    );
    await client.query("commit");
    return {
      ...approval.rows[0],
      bookingId: row.bookingId,
      assignmentId: row.assignmentId,
      assistantId: row.assistantId,
      customerUserId: row.customerUserId,
      requestedMinutes,
      extendedUntil: extendedUntil.toISOString()
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
