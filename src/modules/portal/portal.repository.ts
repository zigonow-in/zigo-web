import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { updateAssistantAvailability } from "../assistant-master/assistantMaster.repository.js";
import {
  createAdminCustomerAddress,
  createAdminCustomerPreviousUsedLocation,
  deleteAdminCustomerAddress,
  listAdminCustomerAddresses,
  listAdminCustomerPreviousUsedLocations,
  saveAdminCustomerPreviousUsedLocationAsAddress,
  setAdminCustomerAddressDefault,
  updateAdminCustomerAddress
} from "../customers/customers.repository.js";
import { ensureCategoryServiceMasterSchema, getBookingCatalog, listBookingEngineQuickRepliesForBooking, listPaymentModeRules, listTaxMasterRules, resolveBookingEngineInstantEtaMinutes } from "../masters/masters.repository.js";
import { ensureBookingEngineSchema, releaseCapacityReservations } from "../operations/bookingEngine.js";
import { goAssistantOffline, goAssistantOnline, recordAssistantHeartbeat, stopAssistantCalendarBlocksForBooking } from "../operations/assistantDispatchEngine.js";
import { createBookingByAdmin, getBookingAvailabilityDecision, listBookingLocationServiceBoundaries, reverseBookingLocation, searchBookingLocations, validateBookingLocation } from "../operations/operations.repository.js";
import { findCustomerPaidRazorpayPaymentByReference, getCustomerRazorpayOrderStatus, linkRazorpayPaymentToBooking } from "../payments/payments.repository.js";
import { getBookingEngineSetting } from "../settings/settings.repository.js";
import { getUserById, sendEmailOtp, sendUserOtpChallenge, verifyUserOtpChallenge, type UserSummary } from "../users/users.repository.js";
import { enqueueCustomerBookingInvoice } from "./bookingInvoice.service.js";

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
  | "payment_received"
  | "approval_request"
  | "approval_response"
  | "time_extension_request"
  | "time_extension_approved";
type Queryable = Pick<typeof pool, "query">;

function normalizeCustomerPaymentType(value: unknown) {
  const normalized = String(value || "cash").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["cash", "cod", "cash_on_delivery"].includes(normalized)) return "cash";
  if (
    normalized === "razorpay"
    || normalized === "upi"
    || normalized === "card"
    || normalized === "netbanking"
    || normalized === "net_banking"
    || normalized.startsWith("online")
  ) return "razorpay";
  return normalized;
}
type PortalFavorites = {
  services: string[];
  categories: string[];
  stores: string[];
};
let portalOlaAccessToken: { token: string; expiresAt: number } | null = null;

function normalizePhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith("91") ? `+${digits}` : `+${digits}`;
}

function phoneDigits(phone?: string | null) {
  return normalizePhone(phone).replace(/\D/g, "");
}

function validDateFromUnknown(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function addMinutes(date: Date | null, minutes: number) {
  if (!date) return null;
  return new Date(date.getTime() + Math.max(0, Number(minutes) || 0) * 60_000);
}

function generateTaskPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function taskPinsFromMetadata(metadata: Record<string, any> | null | undefined) {
  const pins = (metadata?.taskPins && typeof metadata.taskPins === "object" ? metadata.taskPins : {}) as Record<string, any>;
  const normalized: Record<string, any> = {
    ...pins,
    startPin: String(pins.startPin || metadata?.startPin || "").trim(),
    finishPin: String(pins.finishPin || metadata?.finishPin || "").trim()
  };
  return normalized;
}

function taskPinCandidatesFromMetadata(metadata: Record<string, any> | null | undefined, key: "startPin" | "finishPin") {
  const pins = (metadata?.taskPins && typeof metadata.taskPins === "object" ? metadata.taskPins : {}) as Record<string, any>;
  const timerPins = (metadata?.taskTimer?.taskPins && typeof metadata.taskTimer.taskPins === "object" ? metadata.taskTimer.taskPins : {}) as Record<string, any>;
  return [pins[key], metadata?.[key], timerPins[key]]
    .map((value) => String(value || "").trim())
    .filter((value, index, values) => /^\d{4}$/.test(value) && values.indexOf(value) === index);
}

function withoutTaskPins(metadata: Record<string, any> | null | undefined) {
  const clone = { ...(metadata || {}) };
  delete clone.taskPins;
  delete clone.startPin;
  delete clone.finishPin;
  return clone;
}

function isBookingFinalStatus(status: unknown) {
  return ["completed", "success", "done", "cancelled", "canceled", "failed", "rejected", "expired"].includes(String(status || "").toLowerCase());
}

function ceilPositiveMinutes(start: Date | null, end: Date) {
  if (!start) return 0;
  const diffMs = end.getTime() - start.getTime();
  return diffMs > 0 ? Math.ceil(diffMs / 60_000) : 0;
}

function customerBookingCancelEligibility(input: {
  statusCode?: string | null;
  assignmentId?: string | null;
  assignmentStatus?: string | null;
  bookingStartAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  createdAt?: Date | string | null;
  actualTaskStartedAt?: Date | string | null;
  assignmentActualStartedAt?: Date | string | null;
}, settings: Awaited<ReturnType<typeof getBookingEngineSetting>>, now = new Date()) {
  const statusCode = String(input.statusCode || "").toLowerCase();
  const assignmentStatus = String(input.assignmentStatus || "").toLowerCase();
  const finalStatuses = new Set(["completed", "success", "done", "cancelled", "canceled", "failed", "rejected", "expired"]);
  const started = Boolean(
    validDateFromUnknown(input.actualTaskStartedAt) ||
    validDateFromUnknown(input.assignmentActualStartedAt) ||
    ["in_progress", "working", "approval_pending", "completed"].includes(assignmentStatus) ||
    ["in_progress", "working", "approval_pending", "completed"].includes(statusCode)
  );
  const assigned = Boolean(input.assignmentId) && ["accepted", "assigned", "in_progress", "working", "approval_pending", "completed"].includes(assignmentStatus || statusCode);
  const plannedStartAt = validDateFromUnknown(input.bookingStartAt)
    ?? validDateFromUnknown(input.scheduledAt)
    ?? validDateFromUnknown(input.createdAt);
  const openMinutes = Math.max(1, Number(settings.customerAssistantDelayCancelOpenMinutes || 10));
  const autoMinutes = Math.max(openMinutes, Number(settings.customerAssistantDelayAutoCancelMinutes || 30));
  const cancelOpensAt = plannedStartAt ? addMinutes(plannedStartAt, openMinutes) : null;
  const autoCancelAt = plannedStartAt ? addMinutes(plannedStartAt, autoMinutes) : null;
  const delayMinutes = plannedStartAt ? Math.max(0, Math.floor((now.getTime() - plannedStartAt.getTime()) / 60_000)) : 0;
  if (finalStatuses.has(statusCode) || finalStatuses.has(assignmentStatus) || started) {
    return { canCancel: false, reasonCode: "not_cancellable", cancelOpensAt, autoCancelAt, delayMinutes };
  }
  if (assigned) {
    return { canCancel: false, reasonCode: "assistant_assigned", cancelOpensAt, autoCancelAt, delayMinutes };
  }
  return { canCancel: true, reasonCode: "customer_cancel_before_assignment", cancelOpensAt, autoCancelAt, delayMinutes };
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

    create table if not exists zigo.customer_disputes (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      customer_user_id uuid not null references zigo.users(id) on delete cascade,
      assigned_admin_user_id uuid references zigo.users(id) on delete set null,
      status_code text not null default 'open',
      subject text not null default 'Booking dispute',
      description text,
      request_refund boolean not null default false,
      requested_refund_amount_paise int not null default 0,
      payment_mode text,
      resolution_type text,
      resolution_amount_paise int not null default 0,
      resolution_reason text,
      admin_response text,
      resolved_at timestamptz,
      resolved_by_user_id uuid references zigo.users(id) on delete set null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_customer_disputes_booking on zigo.customer_disputes(service_request_id, created_at desc);
    create index if not exists idx_customer_disputes_status on zigo.customer_disputes(status_code, created_at desc);
    create index if not exists idx_customer_disputes_customer on zigo.customer_disputes(customer_user_id, created_at desc);

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

    create table if not exists zigo.booking_reviews (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      customer_user_id uuid not null references zigo.users(id) on delete cascade,
      assistant_id uuid references zigo.assistants(id) on delete set null,
      zigo_rating int not null check (zigo_rating between 1 and 5),
      assistant_rating int not null check (assistant_rating between 1 and 5),
      service_rating int not null check (service_rating between 1 and 5),
      review_text text not null default '',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(service_request_id, customer_user_id)
    );
    create index if not exists idx_booking_reviews_customer on zigo.booking_reviews(customer_user_id, updated_at desc);
    create index if not exists idx_booking_reviews_assistant on zigo.booking_reviews(assistant_id, updated_at desc);
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
        where assignment_id = $1 and status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
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
          and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
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

function accountIsAdminDeactivated(metadata: Record<string, unknown> | null | undefined) {
  return metadataFlag(metadata, "isAdminDeactivated")
    || String(metadata?.deactivationSource || "").toLowerCase() === "admin";
}

function accountCanUsePortal(metadata: Record<string, unknown> | null | undefined) {
  if (accountIsAdminDeactivated(metadata)) return false;
  const status = String(metadata?.accountStatus || metadata?.verificationStatus || "active").toLowerCase();
  return !["inactive", "deactive", "deactivated", "deleted", "blocked"].includes(status);
}

function isPendingPortalOtp(user: UserSummary | null | undefined) {
  if (!user) return false;
  if (accountIsAdminDeactivated(user.metadata)) return false;
  return String(user.accountStatus || "").toLowerCase() === "inactive"
    && String(user.otpVerificationStatus || "").toLowerCase() === "pending";
}

function assertPortalUserCanLogin(
  user: UserSummary | null | undefined,
  actor: PortalActor,
  options: { allowNewCustomerRegistration?: boolean; allowPendingPortalOtp?: boolean } = {}
) {
  if (!user) throw new HttpError(404, "Account not found.");
  if (accountCanUsePortal(user.metadata)) return;
  if (actor === "customer" && options.allowNewCustomerRegistration && !accountIsAdminDeactivated(user.metadata)) return;
  if (options.allowPendingPortalOtp && isPendingPortalOtp(user)) return;
  throw new HttpError(403, actor === "assistant" ? "Assistant account is deactive. Contact admin." : "Customer account is deactive. Contact admin.");
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
  const [settings, taxRules, paymentModes] = await Promise.all([
    getBookingEngineSetting(),
    listTaxMasterRules(),
    listPaymentModeRules()
  ]);
  return {
    bookingEngine: {
      customerCancelInstantMinutes: settings.customerCancelInstantMinutes,
      customerCancelScheduleMinutes: settings.customerCancelScheduleMinutes,
      customerAssistantDelayCancelOpenMinutes: settings.customerAssistantDelayCancelOpenMinutes,
      customerAssistantDelayAutoCancelMinutes: settings.customerAssistantDelayAutoCancelMinutes
    },
    maps: {
      olaMapsApiKey: env.OLA_MAPS_API_KEY ?? null,
      olaMapsStyleUrl: env.OLA_MAPS_STYLE_URL
    },
    customerPortal: settings.customerPortal,
    assistantPortal: settings.assistantPortal,
    adminOverride: settings.adminOverride,
    communication: settings.communication,
    taxRules: taxRules.filter((rule) => rule.isActive),
    paymentMethodsConfigured: paymentModes.length > 0,
    paymentMethods: paymentModes.filter((method) => method.isActive)
  };
}

export async function requestPortalCode(input: { actor: PortalActor; phone: string; displayName?: string | null }) {
  const settings = await getBookingEngineSetting();
  const portal = input.actor === "customer" ? settings.customerPortal : settings.assistantPortal;
  if (!portal.isEnabled) throw new HttpError(403, `${input.actor === "customer" ? "Customer" : "Assistant"} portal is disabled.`);
  if (!portal.loginWithMobileOtp) throw new HttpError(403, "Mobile verification code login is disabled.");
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("begin");
    let identity = await findPortalUserByPhone(client, input.actor, input.phone);
    const isNewCustomerRegistration = !identity && input.actor === "customer";
    if (!identity && input.actor === "customer") {
      identity = await ensureCustomerPortalIdentity(client, input);
    }
    if (!identity) throw new HttpError(404, input.actor === "assistant" ? "Assistant not found for this mobile number." : "Customer not found.");
    if (isNewCustomerRegistration) {
      await client.query("commit");
      committed = true;
    }
    const user = await getUserById(identity.userId);
    assertPortalUserCanLogin(user, input.actor, {
      allowNewCustomerRegistration: isNewCustomerRegistration,
      allowPendingPortalOtp: true
    });
    if (!committed) {
      await client.query("commit");
      committed = true;
    }
    const sent = await sendUserOtpChallenge({ userId: identity.userId, channels: ["mobile"], actorUserId: identity.userId });
    return { userId: identity.userId, sentChannels: sent.sentChannels, deliveries: sent.deliveries, sendWarning: sent.sendWarning };
  } catch (error) {
    if (!committed) await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPortalCode(input: { actor: PortalActor; phone: string; code: string }) {
  const identity = await findPortalUserByPhone(pool, input.actor, input.phone);
  if (!identity) throw new HttpError(404, "Account not found.");
  const existingUser = await getUserById(identity.userId);
  assertPortalUserCanLogin(existingUser, input.actor, { allowPendingPortalOtp: true });
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
  const user = await getUserById(input.userId);
  assertPortalUserCanLogin(user, input.actor);
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
  const availability = input.actor === "assistant" && identity.rows[0]?.assistantId
    ? (await pool.query(
      `
        select status_code as "statusCode",
          latitude,
          longitude,
          updated_at as "updatedAt"
        from zigo.assistant_availability
        where assistant_id = $1
        limit 1
      `,
      [identity.rows[0].assistantId]
    )).rows[0] || null
    : null;
  return {
    actor: input.actor,
    user,
    customerId: identity.rows[0]?.customerId ?? null,
    assistantId: identity.rows[0]?.assistantId ?? null,
    availability,
    cart,
    favorites
  };
}

export async function updateCustomerPortalProfile(userId: string, input: {
  displayName: string;
  email?: string | null;
  gender?: "male" | "female" | "other" | null;
}) {
  await requireCustomerPortalCustomerId(userId);
  const displayName = input.displayName.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const gender = input.gender || null;
  try {
    const result = await pool.query<{ id: string }>(
      `
        update zigo.users
        set display_name = $2,
            email = $3,
            metadata = case
              when $4::text is null then coalesce(metadata, '{}'::jsonb) - 'gender'
              else jsonb_set(coalesce(metadata, '{}'::jsonb), '{gender}', to_jsonb($4::text), true)
            end,
            updated_by = $1,
            updated_at = now()
        where id = $1
          and deleted_at is null
        returning id
      `,
      [userId, displayName, email, gender]
    );
    if (!result.rows[0]) throw new HttpError(404, "Customer profile not found.");
    return getUserById(userId);
  } catch (error: any) {
    if (String(error?.code || "") === "23505") {
      throw new HttpError(409, "Email is already used by another account.");
    }
    throw error;
  }
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

async function resolveCustomerPortalTaxPricing(baseAmount: number, sellingAmount: number) {
  const rules = (await listTaxMasterRules()).filter((rule) => rule.isActive);
  const taxRows = rules.map((rule) => {
    const applicablePrice = rule.taxApplicableOn === "base_price" ? baseAmount : sellingAmount;
    const taxValue = Math.max(0, Number(rule.taxValue || 0));
    let amount = 0;
    if (rule.taxType === "flat") {
      amount = taxValue;
    } else if (rule.taxApplicability === "inclusive") {
      amount = applicablePrice * taxValue / (100 + taxValue || 1);
    } else {
      amount = applicablePrice * taxValue / 100;
    }
    const amountPaise = portalBookingMoneyPaise(amount);
    return {
      id: rule.id,
      label: rule.taxLabel || "GST & Service Fees",
      note: rule.taxNote || "",
      applicableOn: rule.taxApplicableOn === "base_price" ? "base_price" : "selling_price",
      applicability: rule.taxApplicability === "inclusive" ? "inclusive" : "exclusive",
      taxType: rule.taxType === "flat" ? "flat" : "percent",
      taxValue,
      formula: rule.formula || rule.metadata?.formula || "",
      amount: amountPaise / 100,
      amountPaise
    };
  }).filter((row) => row.amountPaise > 0);
  const baseAmountPaise = portalBookingMoneyPaise(baseAmount);
  const sellingAmountPaise = portalBookingMoneyPaise(sellingAmount);
  const inclusiveTaxAmountPaise = taxRows
    .filter((row) => row.applicability === "inclusive")
    .reduce((sum, row) => sum + row.amountPaise, 0);
  const exclusiveTaxAmountPaise = taxRows
    .filter((row) => row.applicability === "exclusive")
    .reduce((sum, row) => sum + row.amountPaise, 0);
  return {
    baseAmountPaise,
    sellingAmountPaise,
    discountAmountPaise: Math.max(0, baseAmountPaise - sellingAmountPaise),
    itemTotalPaise: Math.max(0, sellingAmountPaise - inclusiveTaxAmountPaise),
    taxAmountPaise: inclusiveTaxAmountPaise + exclusiveTaxAmountPaise,
    inclusiveTaxAmountPaise,
    exclusiveTaxAmountPaise,
    totalAmountPaise: sellingAmountPaise + exclusiveTaxAmountPaise,
    taxRows
  };
}

async function resolveCustomerPortalCategoryPrice(input: {
  clusterId: string;
  categoryId: string;
  durationMinutes: number;
  categoryPriceRuleId?: string | null;
}) {
  const selectedRuleId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(input.categoryPriceRuleId || ""))
    ? String(input.categoryPriceRuleId)
    : null;
  const scope = (await pool.query<{
    clusterId: string | null;
    cityId: string | null;
    zoneId: string | null;
    stateId: string | null;
  }>(
    `
      select cl.id as "clusterId", cl.city_id as "cityId", cl.zone_id as "zoneId", city.state_id as "stateId"
      from zigo.clusters cl
      left join zigo.cities city on city.id = cl.city_id
      where cl.id = $1::uuid
      limit 1
    `,
    [input.clusterId]
  )).rows[0] || { clusterId: input.clusterId, cityId: null, zoneId: null, stateId: null };
  const requestedDuration = Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30))));
  const result = await pool.query<{
    id: string;
    categoryId: string;
    categoryName: string;
    categoryCode: string | null;
    categoryImageUrl: string | null;
    serviceId: string | null;
    serviceName: string | null;
    serviceMasterId: string | null;
    serviceMasterName: string | null;
    homeDisplayMode: string | null;
    showInHomePage: boolean | null;
    label: string | null;
    timeDurationMinutes: number;
    basePrice: string | number;
    discountType: string;
    discountValue: string | number;
    sellingPrice: string | number;
    waitingChargeAmount: string | number;
    waitingChargeTimeMinutes: number;
  }>(
    `
      select
        cpr.id,
        cpr.category_id as "categoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        c.image_url as "categoryImageUrl",
        coalesce(c.service_id, parent.service_id) as "serviceId",
        s.name as "serviceName",
        nullif(c.config->'categorySettings'->>'serviceMasterId', '') as "serviceMasterId",
        csm.service_title as "serviceMasterName",
        coalesce(c.config->'categorySettings'->>'homeDisplayMode', case when coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) then 'category' else 'categoryPrice' end) as "homeDisplayMode",
        coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) as "showInHomePage",
        coalesce(nullif(cpr.slab->>'label', ''), nullif(cpr.metadata->>'label', '')) as "label",
        cpr.time_duration_minutes as "timeDurationMinutes",
        cpr.base_price as "basePrice",
        cpr.discount_type as "discountType",
        cpr.discount_value as "discountValue",
        cpr.selling_price as "sellingPrice",
        cpr.waiting_charge_amount as "waitingChargeAmount",
        cpr.waiting_charge_time_minutes as "waitingChargeTimeMinutes",
        case cpr.scope_type
          when 'cluster' then 50
          when 'zone' then 40
          when 'city' then 30
          when 'state' then 20
          else 10
        end as scope_rank,
        case when $1::uuid is not null and cpr.id = $1::uuid then 100 else 0 end as selected_rule_rank,
        case
          when cpr.time_duration_minutes = $2::int then 30
          when cpr.time_duration_minutes > $2::int then 20
          else 10
        end as duration_rank
      from zigo.category_price_rules cpr
      join zigo.categories c on c.id = cpr.category_id
      left join zigo.categories parent on parent.id = c.parent_category_id
      left join zigo.services s on s.id = coalesce(c.service_id, parent.service_id)
      left join zigo.category_service_masters csm on csm.id::text = nullif(c.config->'categorySettings'->>'serviceMasterId', '') and coalesce(csm.is_deleted, false) = false
      where coalesce(cpr.is_deleted, false) = false
        and cpr.is_active = true
        and cpr.category_id = $3::uuid
        and (
          ($1::uuid is not null and cpr.id = $1::uuid)
          or cpr.time_duration_minutes >= $2::int
        )
        and (
          cpr.scope_type = 'all'
          or (cpr.scope_type = 'state' and cpr.state_id = $4::uuid)
          or (cpr.scope_type = 'city' and cpr.city_id = $5::uuid)
          or (cpr.scope_type = 'zone' and cpr.zone_id = $6::uuid)
          or (cpr.scope_type = 'cluster' and cpr.cluster_id = $7::uuid)
        )
      order by selected_rule_rank desc, duration_rank desc, cpr.time_duration_minutes, scope_rank desc, cpr.updated_at desc
      limit 1
    `,
    [
      selectedRuleId,
      requestedDuration,
      input.categoryId,
      scope.stateId,
      scope.cityId,
      scope.zoneId,
      scope.clusterId || input.clusterId
    ]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Category price is not configured for selected category and duration.");
  const basePrice = Math.max(0, Number(row.basePrice || 0));
  const sellingPrice = Math.max(0, Number(row.sellingPrice || 0));
  const waitingChargeAmount = Math.max(0, Number(row.waitingChargeAmount || 0));
  const waitingChargeTimeMinutes = Math.max(0, Math.round(Number(row.waitingChargeTimeMinutes || 0)));
  return {
    ...row,
    durationMinutes: Math.max(1, Math.round(Number(row.timeDurationMinutes || requestedDuration))),
    basePrice,
    sellingPrice,
    discountValue: Math.max(0, Number(row.discountValue || 0)),
    waitingCharge: {
      enabled: waitingChargeAmount > 0 && waitingChargeTimeMinutes > 0,
      amount: waitingChargeAmount,
      chargePerMinutes: waitingChargeTimeMinutes
    }
  };
}

async function portalCategoryRatingStats(categoryIds: string[]) {
  const ids = [...new Set(categoryIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return new Map<string, { ratingAvg: number; ratingCount: number }>();
  const result = await pool.query<{ categoryId: string; ratingAvg: string | number | null; ratingCount: number }>(
    `
      select
        rated.category_id as "categoryId",
        round(avg(rated.service_rating)::numeric, 1) as "ratingAvg",
        count(*)::int as "ratingCount"
      from (
        select distinct
          br.id,
          coalesce(sr.category_id::text, nullif(sr.metadata->>'categoryId', '')) as category_id,
          br.service_rating
        from zigo.booking_reviews br
        join zigo.service_requests sr on sr.id = br.service_request_id
        where coalesce(sr.category_id::text, nullif(sr.metadata->>'categoryId', '')) = any($1::text[])
        union
        select distinct
          br.id,
          item->>'categoryId' as category_id,
          br.service_rating
        from zigo.booking_reviews br
        join zigo.service_requests sr on sr.id = br.service_request_id
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(coalesce(sr.metadata, '{}'::jsonb)->'cartItems') = 'array'
              then coalesce(sr.metadata, '{}'::jsonb)->'cartItems'
            else '[]'::jsonb
          end
        ) item
        where item->>'categoryId' = any($1::text[])
      ) rated
      where rated.category_id is not null and rated.category_id <> ''
      group by rated.category_id
    `,
    [ids]
  );
  return new Map(result.rows.map((row) => [
    String(row.categoryId),
    {
      ratingAvg: Number(row.ratingAvg || 0),
      ratingCount: Number(row.ratingCount || 0)
    }
  ]));
}

async function withPortalCategoryRatings<T extends Record<string, unknown>>(catalog: T): Promise<T> {
  const categories = Array.isArray(catalog.categories) ? catalog.categories as Record<string, unknown>[] : [];
  const masterCategories = Array.isArray(catalog.masterCategories) ? catalog.masterCategories as Record<string, unknown>[] : [];
  const categoryIds = [...categories, ...masterCategories]
    .map((category) => String(category.categoryId || category.id || "").trim())
    .filter(Boolean);
  const ratingMap = await portalCategoryRatingStats(categoryIds);
  const mergeRatings = (rows: Record<string, unknown>[]) => rows.map((row) => {
    const categoryId = String(row.categoryId || row.id || "").trim();
    const stats = ratingMap.get(categoryId);
    if (!stats) return row;
    return {
      ...row,
      ratingAvg: stats.ratingAvg,
      ratingCount: stats.ratingCount,
      serviceRatingAvg: stats.ratingAvg,
      serviceRatingCount: stats.ratingCount
    };
  });
  return {
    ...catalog,
    categories: mergeRatings(categories),
    masterCategories: mergeRatings(masterCategories)
  };
}

export async function listCustomerPortalAssistants(userId: string) {
  const result = await pool.query(
     `with customer_assistants as (
       select cu.id as customer_id,
         ta.assistant_id,
         max(coalesce(sr.completed_at, sr.updated_at, sr.created_at)) as last_completed_at
       from zigo.customers cu
       join zigo.service_requests sr on sr.customer_id = cu.id
       join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
       where cu.user_id = $1::uuid
         and ta.assistant_id is not null
         and (
           lower(coalesce(sr.status_code, '')) in ('completed', 'success', 'done')
           or lower(coalesce(ta.status_code, '')) in ('completed', 'success', 'done')
         )
       group by cu.id, ta.assistant_id
     )
     select a.id as "assistantId",
       u.display_name as "name",
       coalesce(profile_doc.preview_url, u.metadata->>'profilePictureUrl') as "profilePictureUrl",
       coalesce(rating_stats.rating_avg, 0) as "rating",
       coalesce(rating_stats.rating_count, 0)::int as "ratingCount",
       coalesce(task_stats.total_task, 0)::int as "totalTask",
       coalesce(task_stats.completed, 0)::int as "completed",
       coalesce(task_stats.cancelled, 0)::int as "cancelled",
       coalesce(task_stats.rejected, 0)::int as "rejected",
       a.created_at as "assistantSince",
       ca.last_completed_at as "lastCompletedAt"
     from customer_assistants ca
     join zigo.assistants a on a.id = ca.assistant_id
     join zigo.users u on u.id = a.user_id
     left join lateral (
       select f.object_key as preview_url
       from zigo.assistant_documents ad
       left join zigo.document_types dt on dt.id = ad.document_type_id
       left join zigo.files f on f.id = ad.file_id
       where ad.assistant_id = a.id and dt.code in ('profile_picture', 'profile_photo')
       order by ad.created_at desc
       limit 1
     ) profile_doc on true
     left join lateral (
       select round(avg(br.assistant_rating)::numeric, 1) as rating_avg,
         count(*)::int as rating_count
       from zigo.booking_reviews br
       where br.assistant_id = a.id
     ) rating_stats on true
     left join lateral (
       select count(*)::int as total_task,
         count(*) filter (
           where booking_status in ('completed', 'success', 'done')
             or assignment_status in ('completed', 'success', 'done')
         )::int as completed,
         count(*) filter (
           where booking_status in ('cancelled', 'canceled')
             or assignment_status in ('cancelled', 'canceled')
         )::int as cancelled,
         count(*) filter (
           where booking_status in ('failed', 'rejected')
             or assignment_status in ('failed', 'rejected', 'declined', 'not_accepted')
         )::int as rejected
       from (
         select distinct on (task_sr.id) task_sr.id,
           lower(coalesce(task_sr.status_code, '')) as booking_status,
           lower(coalesce(task_ta.status_code, '')) as assignment_status
         from zigo.task_assignments task_ta
         join zigo.service_requests task_sr
           on task_sr.id = task_ta.service_request_id or task_sr.id = task_ta.request_id
         where task_ta.assistant_id = a.id
           and task_sr.customer_id = ca.customer_id
           and lower(coalesce(task_ta.status_code, '')) not in ('released', 'reassigned')
         order by task_sr.id, task_ta.assigned_at desc nulls last, task_ta.offered_at desc nulls last, task_ta.id desc
       ) assistant_tasks
     ) task_stats on true
     where u.deleted_at is null
     order by ca.last_completed_at desc, u.display_name asc`,
    [userId]
  );
  return result.rows;
}

export async function listCustomerPortalBookings(userId: string, input: { tab?: string; page?: number; pageSize?: number; bookingId?: string } = {}) {
  await ensurePortalSchema();
  await ensureBookingEngineSchema();
  await completeExpiredFinishConfirmations(pool);
  const settings = await getBookingEngineSetting();
  const tab = String(input.tab || "all").toLowerCase();
  const bookingId = String(input.bookingId || "").trim() || null;
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(input.pageSize || 10)));
  const offset = (page - 1) * pageSize;
  const tabClause = tab === "all" ? "" :
    tab === "working" ? `
          and lower(coalesce(sr.status_code, '')) in ('working', 'in_progress', 'on_the_way')
        ` :
    tab === "assigned" ? `
          and lower(coalesce(sr.status_code, '')) in ('assigned', 'accepted', 'processing', 'pending', 'hold')
          and sr.accepted_assignment_id is not null
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
          coalesce(bbs.base_price_paise, sr.base_price_paise, 0) as "basePricePaise",
          coalesce(bbs.selling_price_paise, sr.selling_price_paise, 0) as "sellingPricePaise",
          coalesce(bbs.grand_total_paise, sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise",
          coalesce(bbs.discount_paise, sr.discount_paise, 0) as "discountPaise",
          coalesce(bbs.item_total_paise,
            case when sr.metadata->'pricingBreakdown'->>'itemTotalPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'itemTotalPaise')::bigint end,
            sr.selling_price_paise, 0) as "itemTotalPaise",
          coalesce(bbs.tax_amount_paise,
            case when sr.metadata->'pricingBreakdown'->>'taxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'taxAmountPaise')::bigint end,
            0) as "taxAmountPaise",
          coalesce(bbs.inclusive_tax_amount_paise,
            case when sr.metadata->'pricingBreakdown'->>'inclusiveTaxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'inclusiveTaxAmountPaise')::bigint end,
            0) as "inclusiveTaxAmountPaise",
          coalesce(bbs.exclusive_tax_amount_paise,
            case when sr.metadata->'pricingBreakdown'->>'exclusiveTaxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'exclusiveTaxAmountPaise')::bigint end,
            0) as "exclusiveTaxAmountPaise",
          coalesce(bbs.tip_amount_paise,
            case when sr.metadata->'pricingBreakdown'->>'tipAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'tipAmountPaise')::bigint end,
            case when sr.metadata->>'tipAmountPaise' ~ '^\d+$' then (sr.metadata->>'tipAmountPaise')::bigint end,
            0) as "tipAmountPaise",
          coalesce(bbs.grand_total_paise, sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "grandTotalPaise",
          coalesce(bbs.tax_details, sr.metadata->'pricingBreakdown'->'taxRows', sr.payment_details->'taxRows', '[]'::jsonb) as "taxDetails",
          coalesce(bbs.pricing_details, sr.metadata->'pricingBreakdown', '{}'::jsonb) as "billingSnapshot",
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
          sr.completed_at as "completedAt",
          sr.scheduled_at as "scheduledAt",
          sr.booking_start_at as "bookingStartAt",
          sr.booking_end_at as "bookingEndAt",
          sr.booking_available_at as "bookingAvailableAt",
          sr.actual_task_started_at as "actualTaskStartedAt",
          coalesce(sr.scheduled_at, sr.created_at) as "sortAt",
          sr.accepted_assignment_id as "assignmentId",
          ta.status_code as "assignmentStatus",
          ta.actual_started_at as "assignmentActualStartedAt",
          ta.assistant_id as "assistantId",
          au.display_name as "assistantName",
          au.phone as "assistantPhone",
          coalesce(profile_doc.preview_url, au.metadata->>'profilePictureUrl') as "assistantProfilePictureUrl",
          assistant_rating_stats."ratingAvg" as "assistantRatingAvg",
          assistant_rating_stats."ratingCount" as "assistantRatingCount",
          review.data as "customerReview",
          s.name as "serviceName",
          c.name as "clusterName",
          coalesce(
            json_agg(jsonb_build_object('address', rl.address, 'latitude', rl.latitude, 'longitude', rl.longitude) order by rl.sequence)
              filter (where rl.id is not null),
            '[]'::json
          ) as locations
        from zigo.customers cu
        join zigo.service_requests sr on sr.customer_id = cu.id
        left join zigo.booking_billing_snapshots bbs on bbs.service_request_id = sr.id
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
        left join lateral (
          select
            round(avg(br.assistant_rating)::numeric, 1) as "ratingAvg",
            count(*)::int as "ratingCount"
          from zigo.booking_reviews br
          where br.assistant_id = ta.assistant_id
        ) assistant_rating_stats on ta.assistant_id is not null
        left join lateral (
          select jsonb_build_object(
            'id', br.id,
            'bookingId', br.service_request_id,
            'zigoRating', br.zigo_rating,
            'assistantRating', br.assistant_rating,
            'serviceRating', br.service_rating,
            'reviewText', br.review_text,
            'createdAt', br.created_at,
            'updatedAt', br.updated_at
          ) as data
          from zigo.booking_reviews br
          where br.service_request_id = sr.id
            and br.customer_user_id = cu.user_id
          limit 1
        ) review on true
        left join zigo.services s on s.id = sr.service_id
        left join zigo.clusters c on c.id = sr.cluster_id
        left join zigo.request_locations rl on rl.service_request_id = sr.id
        where cu.user_id = $1
        and ($4::uuid is null or sr.id = $4::uuid)
        ${tabClause}
        group by sr.id, bbs.id, ta.status_code, ta.actual_started_at, ta.assistant_id, au.display_name, au.phone, au.metadata, profile_doc.preview_url, assistant_rating_stats."ratingAvg", assistant_rating_stats."ratingCount", review.data, s.name, c.name, sr.scheduled_at, sr.created_at
      )
      select *, count(*) over()::int as "totalRecords"
      from bookings
      order by "sortAt" desc, id desc
      limit $2 offset $3
    `,
    [userId, pageSize, offset, bookingId]
  );
  const updates = await taskUpdatesByBookingIds(pool, result.rows.map((row) => row.id), { userId, actor: "customer" });
  const nowIso = new Date().toISOString();
  for (const row of result.rows as Array<Record<string, any>>) {
    const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, any>;
    const pins = taskPinsFromMetadata(metadata);
    if (!pins.startPin && !isBookingFinalStatus(row.statusCode) && !validDateFromUnknown(row.actualTaskStartedAt)) {
      pins.startPin = generateTaskPin();
      pins.startPinGeneratedAt = nowIso;
      const nextMetadata = { ...metadata, taskPins: pins };
      await pool.query(
        `
          update zigo.service_requests
          set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
          where id = $1
            and actual_task_started_at is null
            and lower(coalesce(status_code, '')) not in ('completed', 'success', 'done', 'cancelled', 'canceled', 'failed', 'rejected', 'expired')
        `,
        [row.id, JSON.stringify({ taskPins: pins })]
      );
      row.metadata = nextMetadata;
    }
  }
  if (bookingId) await attachCustomerLiveRoutes(result.rows as Array<Record<string, any>>);
  const totalRecords = Number(result.rows[0]?.totalRecords || 0);
  return {
    data: result.rows.map((row) => {
      const { totalRecords: _totalRecords, ...booking } = row;
      return {
        ...booking,
        customerCancelEligibility: customerBookingCancelEligibility(booking, settings),
        taskUpdates: updates.get(row.id) || []
      };
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

export async function getCustomerPortalBooking(userId: string, bookingId: string) {
  let result = await listCustomerPortalBookings(userId, { bookingId, tab: "all", page: 1, pageSize: 5 });
  let booking = result.data.find((row) => String(row.id || "") === String(bookingId || "")) || result.data[0] || null;
  if (!booking) throw new HttpError(404, "Booking not found.");
  const metadata = portalBookingRecord(booking.metadata) || {};
  const paymentMetadata = portalBookingRecord(metadata.razorpayPayment) || {};
  const razorpayOrderId = portalBookingText(paymentMetadata, "razorpayOrderId")
    || portalBookingText(paymentMetadata, "razorpay_order_id");
  const paymentType = normalizeCustomerPaymentType(booking.paymentType || metadata.paymentType);
  const paymentStatus = String(booking.paymentStatus || metadata.paymentStatus || "due").toLowerCase();
  const needsPaymentRepair = razorpayOrderId
    && paymentType === "razorpay"
    && booking.isPaid !== true
    && !["paid", "captured", "success", "completed"].includes(paymentStatus);
  if (needsPaymentRepair) {
    const payment = await getCustomerRazorpayOrderStatus({ customerUserId: userId, orderId: razorpayOrderId });
    if (payment.paymentStatus === "paid") {
      await linkRazorpayPaymentToBooking({
        bookingId,
        razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId
      });
      result = await listCustomerPortalBookings(userId, { bookingId, tab: "all", page: 1, pageSize: 5 });
      booking = result.data.find((row) => String(row.id || "") === String(bookingId || "")) || result.data[0] || booking;
    }
  }
  return booking;
}

export async function updateCustomerPortalBookingTip(userId: string, input: { bookingId: string; amountPaise: number }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensurePortalSchema(client);
    await ensureBookingEngineSchema(client);
    const result = await client.query<{
      id: string;
      statusCode: string;
      paymentStatus: string | null;
      isPaid: boolean;
      basePricePaise: number | string | null;
      discountPaise: number | string | null;
      sellingPricePaise: number | string | null;
      bookingAmountPaise: number | string | null;
      waitingChargesPaise: number | string | null;
      metadata: Record<string, any> | null;
      paymentDetails: Record<string, any> | null;
      snapshotBasePricePaise: number | string | null;
      snapshotDiscountPaise: number | string | null;
      snapshotSellingPricePaise: number | string | null;
      snapshotItemTotalPaise: number | string | null;
      snapshotTaxAmountPaise: number | string | null;
      snapshotInclusiveTaxAmountPaise: number | string | null;
      snapshotExclusiveTaxAmountPaise: number | string | null;
      snapshotTipAmountPaise: number | string | null;
      snapshotWaitingChargesPaise: number | string | null;
      snapshotGrandTotalPaise: number | string | null;
      snapshotTaxDetails: unknown;
      snapshotPricingDetails: Record<string, any> | null;
    }>(
      `select sr.id, sr.status_code as "statusCode", sr.payment_status as "paymentStatus",
              sr.is_paid as "isPaid", sr.base_price_paise as "basePricePaise",
              sr.discount_paise as "discountPaise", sr.selling_price_paise as "sellingPricePaise",
              sr.booking_amount_paise as "bookingAmountPaise",
              sr.waiting_charges_paise as "waitingChargesPaise",
              sr.metadata, sr.payment_details as "paymentDetails",
              bbs.base_price_paise as "snapshotBasePricePaise",
              bbs.discount_paise as "snapshotDiscountPaise",
              bbs.selling_price_paise as "snapshotSellingPricePaise",
              bbs.item_total_paise as "snapshotItemTotalPaise",
              bbs.tax_amount_paise as "snapshotTaxAmountPaise",
              bbs.inclusive_tax_amount_paise as "snapshotInclusiveTaxAmountPaise",
              bbs.exclusive_tax_amount_paise as "snapshotExclusiveTaxAmountPaise",
              bbs.tip_amount_paise as "snapshotTipAmountPaise",
              bbs.waiting_charges_paise as "snapshotWaitingChargesPaise",
              bbs.grand_total_paise as "snapshotGrandTotalPaise",
              bbs.tax_details as "snapshotTaxDetails",
              bbs.pricing_details as "snapshotPricingDetails"
         from zigo.service_requests sr
         join zigo.customers c on c.id = sr.customer_id
         left join zigo.booking_billing_snapshots bbs on bbs.service_request_id = sr.id
        where sr.id = $1::uuid and c.user_id = $2::uuid
        for update of sr`,
      [input.bookingId, userId]
    );
    const booking = result.rows[0];
    if (!booking) throw new HttpError(404, "Booking not found.");
    const statusCode = String(booking.statusCode || "").toLowerCase();
    if (["cancelled", "canceled", "rejected", "failed"].includes(statusCode)) throw new HttpError(409, "Tip cannot be changed for this booking.");
    const paymentStatus = String(booking.paymentStatus || booking.paymentDetails?.paymentStatus || "due").toLowerCase();
    if (booking.isPaid || ["paid", "captured", "success", "completed", "pending", "processing", "attempted"].includes(paymentStatus)) {
      throw new HttpError(409, "Tip cannot be changed after payment is submitted.");
    }

    const amountPaise = Math.max(0, Math.min(100_000, Math.round(Number(input.amountPaise || 0))));
    const metadata = booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
    const paymentDetails = booking.paymentDetails && typeof booking.paymentDetails === "object" ? booking.paymentDetails : {};
    const existingPricing = booking.snapshotPricingDetails && typeof booking.snapshotPricingDetails === "object"
      ? booking.snapshotPricingDetails
      : portalBookingRecord(metadata.pricingBreakdown) || portalBookingRecord(paymentDetails.pricingBreakdown) || {};
    const numberValue = (...values: unknown[]) => {
      for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        const number = Number(value);
        if (Number.isFinite(number)) return Math.max(0, Math.round(number));
      }
      return 0;
    };
    const basePricePaise = numberValue(booking.snapshotBasePricePaise, booking.basePricePaise, existingPricing.basePricePaise, existingPricing.baseAmountPaise);
    const discountPaise = numberValue(booking.snapshotDiscountPaise, booking.discountPaise, existingPricing.discountPaise, existingPricing.discountAmountPaise);
    const sellingPricePaise = numberValue(booking.snapshotSellingPricePaise, booking.sellingPricePaise, existingPricing.sellingPricePaise, existingPricing.sellingAmountPaise);
    const inclusiveTaxAmountPaise = numberValue(booking.snapshotInclusiveTaxAmountPaise, existingPricing.inclusiveTaxAmountPaise);
    const exclusiveTaxAmountPaise = numberValue(booking.snapshotExclusiveTaxAmountPaise, existingPricing.exclusiveTaxAmountPaise);
    const taxAmountPaise = numberValue(booking.snapshotTaxAmountPaise, existingPricing.taxAmountPaise, inclusiveTaxAmountPaise + exclusiveTaxAmountPaise);
    const itemTotalPaise = numberValue(booking.snapshotItemTotalPaise, existingPricing.itemTotalPaise, sellingPricePaise - inclusiveTaxAmountPaise);
    const waitingChargesPaise = numberValue(booking.snapshotWaitingChargesPaise, booking.waitingChargesPaise, existingPricing.waitingChargesPaise);
    const previousTipAmountPaise = numberValue(booking.snapshotTipAmountPaise, existingPricing.tipAmountPaise, metadata.tipAmountPaise);
    const currentGrandTotalPaise = numberValue(booking.snapshotGrandTotalPaise, booking.bookingAmountPaise, existingPricing.grandTotalPaise, existingPricing.totalAmountPaise);
    const grandTotalPaise = Math.max(0, currentGrandTotalPaise - previousTipAmountPaise + amountPaise);
    const taxRows = Array.isArray(booking.snapshotTaxDetails)
      ? booking.snapshotTaxDetails
      : Array.isArray(existingPricing.taxRows) ? existingPricing.taxRows : [];
    const pricingBreakdown = {
      ...existingPricing,
      baseAmountPaise: basePricePaise,
      basePricePaise,
      discountAmountPaise: discountPaise,
      discountPaise,
      sellingAmountPaise: sellingPricePaise,
      sellingPricePaise,
      itemTotalPaise,
      taxAmountPaise,
      inclusiveTaxAmountPaise,
      exclusiveTaxAmountPaise,
      tipAmountPaise: amountPaise,
      tipDetails: { amountPaise, source: "customer_track_booking" },
      waitingChargesPaise,
      grandTotalPaise,
      totalAmountPaise: grandTotalPaise,
      taxRows
    };

    await client.query(
      `insert into zigo.booking_billing_snapshots
        (service_request_id, base_price_paise, discount_paise, selling_price_paise,
         item_total_paise, tax_amount_paise, inclusive_tax_amount_paise,
         exclusive_tax_amount_paise, tip_amount_paise, waiting_charges_paise,
         grand_total_paise, currency, tax_details, pricing_details)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'INR', $12::jsonb, $13::jsonb)
       on conflict (service_request_id) do update set
         base_price_paise = excluded.base_price_paise,
         discount_paise = excluded.discount_paise,
         selling_price_paise = excluded.selling_price_paise,
         item_total_paise = excluded.item_total_paise,
         tax_amount_paise = excluded.tax_amount_paise,
         inclusive_tax_amount_paise = excluded.inclusive_tax_amount_paise,
         exclusive_tax_amount_paise = excluded.exclusive_tax_amount_paise,
         tip_amount_paise = excluded.tip_amount_paise,
         waiting_charges_paise = excluded.waiting_charges_paise,
         grand_total_paise = excluded.grand_total_paise,
         tax_details = excluded.tax_details,
         pricing_details = excluded.pricing_details,
         updated_at = now()`,
      [booking.id, basePricePaise, discountPaise, sellingPricePaise, itemTotalPaise,
        taxAmountPaise, inclusiveTaxAmountPaise, exclusiveTaxAmountPaise, amountPaise,
        waitingChargesPaise, grandTotalPaise, JSON.stringify(taxRows), JSON.stringify(pricingBreakdown)]
    );
    await client.query(
      `update zigo.service_requests
          set booking_amount_paise = $2,
              metadata = $3::jsonb,
              payment_details = $4::jsonb,
              updated_at = now()
        where id = $1::uuid`,
      [booking.id, grandTotalPaise, JSON.stringify({
        ...metadata,
        tipAmountPaise: amountPaise,
        grandTotalPaise,
        bookingAmountPaise: grandTotalPaise,
        paymentAmountPaise: grandTotalPaise,
        pricingBreakdown
      }), JSON.stringify({
        ...paymentDetails,
        tipAmountPaise: amountPaise,
        grandTotalPaise,
        amountPaise: grandTotalPaise,
        taxRows,
        pricingBreakdown
      })]
    );
    await client.query("commit");
    return { bookingId: booking.id, tipAmountPaise: amountPaise, grandTotalPaise, pricingBreakdown };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveCustomerPortalBookingReview(userId: string, input: {
  bookingId: string;
  zigoRating: number;
  assistantRating: number;
  serviceRating: number;
  reviewText?: string | null;
}) {
  await ensurePortalSchema();
  const reviewText = String(input.reviewText || "").trim();
  const target = await pool.query<{ bookingId: string; assistantId: string | null; reviewId: string | null; statusCode: string | null }>(
    `
      select sr.id as "bookingId", ta.assistant_id as "assistantId", sr.status_code as "statusCode", br.id as "reviewId"
      from zigo.customers cu
      join zigo.service_requests sr on sr.customer_id = cu.id
      left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
      left join zigo.booking_reviews br on br.service_request_id = sr.id and br.customer_user_id = cu.user_id
      where cu.user_id = $1
        and sr.id = $2
      limit 1
    `,
    [userId, input.bookingId]
  );
  if (!target.rows[0]) throw new HttpError(404, "Booking not found for review.");
  const statusCode = String(target.rows[0].statusCode || "").toLowerCase();
  if (!["completed", "success", "done"].includes(statusCode)) {
    throw new HttpError(409, "Review is available after successful completion.");
  }
  if (target.rows[0].reviewId) throw new HttpError(409, "Review already submitted.");
  const result = await pool.query(
    `
      insert into zigo.booking_reviews
        (service_request_id, customer_user_id, assistant_id, zigo_rating, assistant_rating, service_rating, review_text, metadata)
      values ($1, $2, $3, $4::int, $5::int, $6::int, $7::text, jsonb_build_object('source', 'customer_portal'))
      returning
        id,
        service_request_id as "bookingId",
        zigo_rating as "zigoRating",
        assistant_rating as "assistantRating",
        service_rating as "serviceRating",
        review_text as "reviewText",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      target.rows[0].bookingId,
      userId,
      target.rows[0].assistantId,
      Math.max(1, Math.min(5, Math.round(Number(input.zigoRating || 0)))),
      Math.max(1, Math.min(5, Math.round(Number(input.assistantRating || 0)))),
      Math.max(1, Math.min(5, Math.round(Number(input.serviceRating || 0)))),
      reviewText
    ]
  );
  if (!result.rows[0]) throw new HttpError(404, "Booking not found for review.");
  return result.rows[0];
}

export async function createCustomerPortalDispute(userId: string, input: {
  bookingId: string;
  subject: string;
  description: string;
  requestRefund?: boolean;
  requestedRefundAmountPaise?: number;
}) {
  await ensurePortalSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const booking = await client.query<{
      bookingId: string;
      requestNumber: string | null;
      paymentType: string | null;
      bookingAmountPaise: number | null;
    }>(
      `
        select sr.id as "bookingId", sr.request_number as "requestNumber",
          sr.payment_type as "paymentType",
          coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise"
        from zigo.customers cu
        join zigo.service_requests sr on sr.customer_id = cu.id
        where cu.user_id = $1::uuid and sr.id = $2::uuid
        limit 1
      `,
      [userId, input.bookingId]
    );
    const row = booking.rows[0];
    if (!row) throw new HttpError(404, "Booking not found for this customer.");
    const refundAmount = Math.max(0, Math.min(
      Math.round(Number(input.requestedRefundAmountPaise || 0)),
      Math.max(0, Number(row.bookingAmountPaise || 0))
    ));
    const dispute = await client.query(
      `
        insert into zigo.customer_disputes
          (service_request_id, customer_user_id, status_code, subject, description, request_refund,
           requested_refund_amount_paise, payment_mode, metadata)
        values ($1::uuid, $2::uuid, 'open', $3::text, $4::text, $5::boolean, $6::int, $7::text, $8::jsonb)
        returning id, service_request_id as "bookingId", status_code as "statusCode", subject, description,
          request_refund as "requestRefund", requested_refund_amount_paise as "requestedRefundAmountPaise",
          payment_mode as "paymentMode", created_at as "createdAt", updated_at as "updatedAt"
      `,
      [
        row.bookingId,
        userId,
        input.subject || "Booking dispute",
        input.description,
        Boolean(input.requestRefund),
        refundAmount,
        row.paymentType || "cash",
        JSON.stringify({ requestNumber: row.requestNumber, source: "customer_track_booking" })
      ]
    );
    const disputeId = dispute.rows[0].id;
    await client.query(
      `
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1::uuid, null, $2::uuid, 'customer', 'text', $3::text, '[]'::jsonb, $4::jsonb)
      `,
      [
        row.bookingId,
        userId,
        input.description,
        JSON.stringify({
          disputeId,
          disputeAction: "opened",
          subject: input.subject || "Booking dispute",
          requestRefund: Boolean(input.requestRefund),
          requestedRefundAmountPaise: refundAmount
        })
      ]
    );
    await client.query("commit");
    return dispute.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCustomerPortalCatalog(filters: {
  clusterId?: string;
  serviceId?: string;
  categoryId?: string;
  q?: string;
} = {}) {
  await ensurePortalSchema();
  if (filters.clusterId) {
    const catalog = await getBookingCatalog({
      clusterId: filters.clusterId,
      serviceId: filters.serviceId,
      categoryId: filters.categoryId,
      q: filters.q
    });
    return withPortalCategoryRatings(catalog as Record<string, unknown>);
  }

  await ensureCategoryServiceMasterSchema();
  const defaultInstantEtaMinutes = await resolveBookingEngineInstantEtaMinutes({
    clusterId: filters.clusterId,
    categoryId: filters.categoryId
  });

  const [clusters, services, serviceMasters, categories, masterCategories, stores] = await Promise.all([
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
          id,
          service_title as "serviceTitle",
          service_subtitle as "serviceSubtitle",
          coalesce(icons, '[]'::jsonb) as "icons",
          coalesce(service_title_font_size, 18) as "serviceTitleFontSize",
          coalesce(service_title_font_weight, 400) as "serviceTitleFontWeight",
          coalesce(service_title_color, '') as "serviceTitleColor",
          coalesce(service_subtitle_font_size, 13) as "serviceSubtitleFontSize",
          coalesce(service_subtitle_font_weight, 400) as "serviceSubtitleFontWeight",
          coalesce(service_subtitle_color, '') as "serviceSubtitleColor",
          coalesce(booking_type, 'both') as "bookingType",
          coalesce(show_eta, false) as "showEta",
          $1::int as "instantEtaMinutes",
          service_position as "servicePosition",
          coalesce(service_category_grid_size, '3x3') as "serviceCategoryGridSize",
          is_enabled as "isEnabled",
          is_active as "isActive"
        from zigo.category_service_masters
        where coalesce(is_deleted, false) = false
          and coalesce(is_active, true) = true
          and coalesce(is_enabled, true) = true
        order by service_position, service_title
        limit 80
      `,
      [defaultInstantEtaMinutes]
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
          coalesce(c.config->'categorySettings'->'imageUrls', '[]'::jsonb) as "imageUrls",
          coalesce((c.config->'pricing'->>'basePrice')::numeric, 0) as "basePrice",
          coalesce((c.config->'pricing'->>'sellingPrice')::numeric, 0) as "sellingPrice",
          coalesce(nullif(c.config->'allottedTime'->>'durationMinutes', '')::int, 30) as "durationMinutes",
          coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
          c.config->'categorySettings'->>'expandTitle' as "expandTitle",
          coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
          c.config->'categorySettings'->>'expandDescription' as "expandDescription",
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
          nullif(c.config->'categorySettings'->>'serviceMasterId', '') as "serviceMasterId",
          csm.service_title as "serviceMasterName",
          c.code,
          c.name,
          c.description,
          c.image_url as "imageUrl",
          coalesce(c.config->'categorySettings'->'imageUrls', '[]'::jsonb) as "imageUrls",
          c.priority,
          c.sort_order as "sortOrder",
          c.is_recommended as "isRecommended",
          c.config->'categorySettings'->>'note' as "note",
          coalesce(c.config->'categorySettings'->>'locationMode', 'current') as "locationMode",
          coalesce(nullif(c.config->'categorySettings'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
          coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) as "showInHomePage",
          coalesce(c.config->'categorySettings'->>'homeDisplayMode', case when coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) then 'category' else 'categoryPrice' end) as "homeDisplayMode",
          coalesce(nullif(c.config->'categorySettings'->>'categoryImageHeight', '')::int, 0) as "categoryImageHeight",
          coalesce(nullif(c.config->'categorySettings'->>'categoryImageWidth', '')::int, 0) as "categoryImageWidth",
          coalesce(c.config->'categorySettings'->>'priceDisplayMode', 'row') as "priceDisplayMode",
          coalesce(nullif(c.config->'categorySettings'->>'priceGridRows', '')::int, 3) as "priceGridRows",
          coalesce(nullif(c.config->'categorySettings'->>'priceGridColumns', '')::int, 3) as "priceGridColumns",
          coalesce(c.config->'categorySettings'->>'supplyUnavailableAction', '') as "supplyUnavailableAction",
          c.config->'categorySettings'->>'supplyUnavailableMessage' as "supplyUnavailableMessage",
          coalesce((c.config->'categorySettings'->>'addWithOtherCategory')::boolean, false) as "addWithOtherCategory",
          coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
          c.config->'categorySettings'->>'expandTitle' as "expandTitle",
          coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
          c.config->'categorySettings'->>'expandDescription' as "expandDescription",
          coalesce(c.config->'categoryGuidance'->>'taskListTitle', 'Tasks related to category') as "taskListTitle",
          coalesce(c.config->'categoryGuidance'->'taskList', '[]'::jsonb) as "taskList",
          coalesce(c.config->'categoryGuidance'->>'canDoTitle', 'What Assistant can do') as "canDoTitle",
          coalesce(c.config->'categoryGuidance'->'canDoList', '[]'::jsonb) as "canDoList",
          coalesce(c.config->'categoryGuidance'->>'cantDoTitle', 'What Assistant can''t do') as "cantDoTitle",
          coalesce(c.config->'categoryGuidance'->'cantDoList', '[]'::jsonb) as "cantDoList",
          c.is_active as "isActive",
          c.is_enabled as "isEnabled"
        from zigo.categories c
        left join zigo.category_service_masters csm
          on csm.id::text = nullif(c.config->'categorySettings'->>'serviceMasterId', '')
         and coalesce(csm.is_deleted, false) = false
         and coalesce(csm.is_active, true) = true
         and coalesce(csm.is_enabled, true) = true
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
  return withPortalCategoryRatings({
    clusters: clusters.rows,
    services: services.rows,
    serviceMasters: serviceMasters.rows,
    categories: categories.rows,
    masterCategories: masterCategories.rows,
    stores: stores.rows
  });
}

async function requireCustomerPortalCustomerId(userId: string) {
  // Customer portal tokens are issued only to customer users. Repair legacy or
  // partially-created identities here so first-login location validation does
  // not fail before the customer has saved an address or placed a booking.
  const customer = await pool.query<{ id: string }>(
    `
      insert into zigo.customers (user_id, customer_code)
      select u.id, 'CUS-' || upper(replace(u.id::text, '-', ''))
      from zigo.users u
      where u.id = $1::uuid
        and u.deleted_at is null
      on conflict (user_id) do update
        set user_id = excluded.user_id
      returning id
    `,
    [userId]
  );
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

export async function listCustomerPortalServiceBoundaries(userId: string) {
  await requireCustomerPortalCustomerId(userId);
  return listBookingLocationServiceBoundaries();
}

export async function listCustomerPortalAddresses(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  const rows = await listAdminCustomerAddresses(customerId);
  return rows.filter((address: any) => String(address.metadata?.addressKind || "saved") !== "current_default");
}

export async function listCustomerPortalPreviousUsedLocations(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  return listAdminCustomerPreviousUsedLocations(customerId);
}

export async function getCustomerPortalDefaultLocation(userId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  const result = await pool.query(
    `
      select
        ca.id as "addressId",
        ca.customer_id as "customerId",
        ca.label,
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        ca.is_default as "isDefault",
        ca.metadata,
        ca.created_at as "createdAt",
        ca.updated_at as "updatedAt"
      from zigo.customer_addresses ca
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where ca.customer_id = $1
        and ca.deleted_at is null
        and ca.is_default = true
        and ca.metadata->>'addressKind' = 'current_default'
      order by ca.updated_at desc, ca.created_at desc
      limit 1
    `,
    [customerId]
  );
  return result.rows[0] ?? null;
}

function portalLocationCoordinatesMatch(left: { latitude?: unknown; longitude?: unknown }, right: { latitude?: unknown; longitude?: unknown }) {
  const leftLat = Number(left.latitude);
  const leftLng = Number(left.longitude);
  const rightLat = Number(right.latitude);
  const rightLng = Number(right.longitude);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;
  return Math.abs(leftLat - rightLat) <= 0.00001 && Math.abs(leftLng - rightLng) <= 0.00001;
}

function portalAddressKind(row: any) {
  return String(row?.metadata?.addressKind || "saved");
}

async function listCustomerPortalCoordinateRows(customerId: string) {
  const [savedAddresses, previousLocations, currentDefaults] = await Promise.all([
    listAdminCustomerAddresses(customerId),
    listAdminCustomerPreviousUsedLocations(customerId),
    pool.query(
      `
        select
          id as "addressId",
          label,
          address_text as address,
          latitude,
          longitude,
          is_default as "isDefault",
          metadata
        from zigo.customer_addresses
        where customer_id = $1
          and deleted_at is null
          and metadata->>'addressKind' = 'current_default'
      `,
      [customerId]
    )
  ]);
  return [...savedAddresses, ...previousLocations, ...currentDefaults.rows];
}

async function assertCustomerPortalLocationNotDuplicate(customerId: string, input: { latitude: number; longitude: number }) {
  await assertCustomerPortalLocationNotDuplicateExcept(customerId, input, "");
}

async function assertCustomerPortalLocationNotDuplicateExcept(
  customerId: string,
  input: { latitude: number; longitude: number },
  excludeAddressId = "",
  options: { ignoreAddressKinds?: string[] } = {}
) {
  const ignoredKinds = new Set((options.ignoreAddressKinds || []).map((kind) => String(kind || "").trim()).filter(Boolean));
  const locations = await listCustomerPortalCoordinateRows(customerId);
  const duplicate = locations.find((location) => {
    if (excludeAddressId && String(location.addressId || "") === String(excludeAddressId)) return false;
    if (ignoredKinds.has(portalAddressKind(location))) return false;
    return portalLocationCoordinatesMatch(location, input);
  });
  if (duplicate) throw new HttpError(409, "Location already used.");
}

async function assertCustomerPortalAddressLabelAvailable(customerId: string, label: string, excludeAddressId = "") {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return;
  const savedAddresses = await listAdminCustomerAddresses(customerId);
  const duplicate = savedAddresses.find((address) => {
    if (portalAddressKind(address) === "current_default") return false;
    if (excludeAddressId && String(address.addressId || "") === String(excludeAddressId)) return false;
    return String(address.label || "").trim().toLowerCase() === normalizedLabel.toLowerCase();
  });
  if (!duplicate) return;
  throw new HttpError(409, `${normalizedLabel} is already saved.`);
}

async function findCustomerPortalAddressByLabel(customerId: string, label: string) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return null;
  const savedAddresses = await listAdminCustomerAddresses(customerId);
  return savedAddresses.find((address: any) => {
    if (portalAddressKind(address) === "current_default") return false;
    return String(address.label || "").trim().toLowerCase() === normalizedLabel.toLowerCase();
  }) || null;
}

export async function saveCustomerPortalPreviousUsedLocation(userId: string, input: {
  address: string;
  latitude: number;
  longitude: number;
  stateName?: string | null;
  postalCode?: string | null;
  source?: string | null;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
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
  await assertCustomerPortalLocationNotDuplicate(customerId, input);
  return createAdminCustomerPreviousUsedLocation(customerId, {
    label: "Previous used",
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    clusterId: serviceability.cluster.clusterId,
    isDefault: true,
    metadata: {
      latitude: input.latitude,
      longitude: input.longitude,
      stateName: input.stateName || "",
      postalCode: input.postalCode || "",
      source: input.source || "manual",
      serviceability
    },
    userId
  });
}

export async function setCustomerPortalDefaultAddress(userId: string, addressId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  return setAdminCustomerAddressDefault(customerId, addressId, userId);
}

export async function deleteCustomerPortalAddress(userId: string, addressId: string) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  return deleteAdminCustomerAddress(customerId, addressId, userId);
}

export async function saveCustomerPortalDefaultLocation(userId: string, input: {
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string | null;
  personName?: string | null;
  contactNumber?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
  source?: string | null;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
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
  const metadata = {
    addressKind: "current_default",
    landmark: input.landmark || "",
    additionalDetail: input.landmark || "",
    personName: input.personName || "",
    contactNumber: input.contactNumber || "",
    stateName: input.stateName || "",
    cityName: input.cityName || "",
    postalCode: input.postalCode || "",
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source || "manual",
    serviceability
  };
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "update zigo.customer_addresses set is_default = false, updated_by = $2, updated_at = now() where customer_id = $1 and deleted_at is null",
      [customerId, userId]
    );
    const existing = await client.query<{ addressId: string }>(
      `
        select id as "addressId"
        from zigo.customer_addresses
        where customer_id = $1
          and deleted_at is null
          and metadata->>'addressKind' = 'current_default'
        order by updated_at desc, created_at desc
        limit 1
      `,
      [customerId]
    );
    const addressId = existing.rows[0]?.addressId || null;
    const result = addressId
      ? await client.query(
          `
            update zigo.customer_addresses
            set label = 'Current location',
                address_text = $3,
                latitude = $4,
                longitude = $5,
                cluster_id = $6,
                is_default = true,
                metadata = $7::jsonb,
                updated_by = $8,
                updated_at = now()
            where customer_id = $1
              and id = $2
              and deleted_at is null
            returning id as "addressId"
          `,
          [
            customerId,
            addressId,
            input.address,
            input.latitude,
            input.longitude,
            serviceability.cluster.clusterId,
            JSON.stringify(metadata),
            userId
          ]
        )
      : await client.query(
          `
            insert into zigo.customer_addresses
              (customer_id, label, address_text, latitude, longitude, cluster_id, is_default, metadata, created_by, updated_by)
            values ($1, 'Current location', $2, $3, $4, $5, true, $6::jsonb, $7, $7)
            returning id as "addressId"
          `,
          [
            customerId,
            input.address,
            input.latitude,
            input.longitude,
            serviceability.cluster.clusterId,
            JSON.stringify(metadata),
            userId
          ]
        );
    await client.query("commit");
    return {
      ...result.rows[0],
      label: "Current location",
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      clusterId: serviceability.cluster.clusterId,
      clusterName: serviceability.cluster.name,
      zoneName: serviceability.cluster.zoneName,
      cityName: serviceability.cluster.cityName,
      isDefault: true,
      metadata
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function assertCustomerPortalSavedAddressDetails(input: {
  landmark?: string | null;
  personName?: string | null;
  contactNumber?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
}) {
  if (!String(input.landmark || "").trim()) throw new HttpError(400, "Enter detailed address.");
  if (!String(input.personName || "").trim()) throw new HttpError(400, "Enter name.");
  const mobile = String(input.contactNumber || "").replace(/\D/g, "");
  if (mobile.length !== 10) throw new HttpError(400, "Enter a valid 10 digit mobile number.");
  if (!String(input.cityName || "").trim()) throw new HttpError(400, "Enter city.");
  if (!/^\d{6}$/.test(String(input.postalCode || "").trim())) throw new HttpError(400, "Enter a valid 6 digit pincode.");
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
  stateName?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
  source?: string | null;
  isDefault?: boolean;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  assertCustomerPortalSavedAddressDetails(input);
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
  const existingLabelAddress = await findCustomerPortalAddressByLabel(customerId, finalLabel);
  if (existingLabelAddress?.addressId) {
    await assertCustomerPortalLocationNotDuplicateExcept(customerId, input, existingLabelAddress.addressId, {
      ignoreAddressKinds: ["previous_used", "current_default"]
    });
    return updateAdminCustomerAddress(customerId, existingLabelAddress.addressId, {
      label: finalLabel,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      clusterId: serviceability.cluster.clusterId,
      isDefault: input.isDefault ?? true,
      metadata: {
        landmark: input.landmark || "",
        personName: input.personName || "",
        contactNumber: input.contactNumber || "",
        stateName: input.stateName || "",
        cityName: input.cityName || "",
        postalCode: input.postalCode || "",
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source || "manual",
        serviceability
      },
      userId
    });
  }
  await assertCustomerPortalLocationNotDuplicate(customerId, input);
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
      stateName: input.stateName || "",
      cityName: input.cityName || "",
      postalCode: input.postalCode || "",
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || "manual",
      serviceability
    },
    userId
  });
}

export async function updateCustomerPortalAddress(userId: string, addressId: string, input: {
  label?: string | null;
  customLabel?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string | null;
  personName?: string | null;
  contactNumber?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
  source?: string | null;
  isDefault?: boolean;
}) {
  const customerId = await requireCustomerPortalCustomerId(userId);
  assertCustomerPortalSavedAddressDetails(input);
  const finalLabel = input.label === "Other" ? input.customLabel?.trim() : input.label?.trim();
  if (!finalLabel) throw new HttpError(400, "Enter address label name.");
  if (input.label === "Other" && ["home", "work", "other"].includes(finalLabel.toLowerCase())) {
    throw new HttpError(400, "This label is already used by default labels, try different.");
  }
  await assertCustomerPortalAddressLabelAvailable(customerId, finalLabel, addressId);
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
  const metadata = {
    landmark: input.landmark || "",
    additionalDetail: input.landmark || "",
    personName: input.personName || "",
    contactNumber: input.contactNumber || "",
    stateName: input.stateName || "",
    cityName: input.cityName || "",
    postalCode: input.postalCode || "",
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source || "manual",
    serviceability
  };
  const previous = await listAdminCustomerPreviousUsedLocations(customerId);
  const isPreviousUsed = previous.some((location) => String(location.addressId || "") === String(addressId || ""));
  await assertCustomerPortalLocationNotDuplicateExcept(customerId, input, addressId, {
    ignoreAddressKinds: ["previous_used", "current_default"]
  });
  if (isPreviousUsed) {
    const saved = await saveAdminCustomerPreviousUsedLocationAsAddress(customerId, addressId, {
      label: finalLabel,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      clusterId: serviceability.cluster.clusterId,
      isDefault: input.isDefault ?? false,
      metadata,
      userId
    });
    if (!saved) throw new HttpError(404, "Previous used location not found.");
    return saved;
  }
  const updated = await updateAdminCustomerAddress(customerId, addressId, {
    label: finalLabel,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    clusterId: serviceability.cluster.clusterId,
    isDefault: input.isDefault ?? false,
    metadata,
    userId
  });
  if (!updated) throw new HttpError(404, "Customer address not found.");
  return updated;
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
  if (!selectedCategoryId) throw new HttpError(400, "Select a category before confirming booking.");
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
  const requestedDurationMinutes = Math.max(1, Math.min(1440, Math.round(
    portalBookingNumber(selectedCartItem, "durationMinutes", Number(input.durationMinutes || metadata.durationMinutes || 30))
  )));
  const selectedCategoryPriceRuleId = portalBookingText(selectedCartItem, "categoryPriceRuleId")
    || portalBookingText(metadata, "categoryPriceRuleId")
    || null;
  const resolvedCategoryPrice = await resolveCustomerPortalCategoryPrice({
    clusterId: input.clusterId,
    categoryId: selectedCategoryId,
    durationMinutes: requestedDurationMinutes,
    categoryPriceRuleId: selectedCategoryPriceRuleId
  });
  const selectedServiceId = resolvedCategoryPrice.serviceId || category?.serviceId || null;
  const categoryName = resolvedCategoryPrice.categoryName || category?.name || "Category";
  const serviceName = resolvedCategoryPrice.serviceName || category?.serviceName || "Category";
  const durationMinutes = resolvedCategoryPrice.durationMinutes;
  const selectedPrice = resolvedCategoryPrice.sellingPrice;
  const selectedBasePrice = resolvedCategoryPrice.basePrice;
  const resolvedTaxPricing = await resolveCustomerPortalTaxPricing(selectedBasePrice, selectedPrice);
  const requestedTipAmountPaise = Math.max(0, Math.min(100_000, Math.round(Number(
    metadata.tipAmountPaise
    || portalBookingRecord(metadata.pricingBreakdown)?.tipAmountPaise
    || 0
  ))));
  const pricingBreakdown = {
    ...resolvedTaxPricing,
    categoryPriceRuleId: resolvedCategoryPrice.id,
    discountType: resolvedCategoryPrice.discountType || "none",
    discountValue: resolvedCategoryPrice.discountValue,
    discountDetails: {
      type: resolvedCategoryPrice.discountType || "none",
      value: resolvedCategoryPrice.discountValue,
      amountPaise: resolvedTaxPricing.discountAmountPaise
    },
    tipAmountPaise: requestedTipAmountPaise,
    tipDetails: {
      amountPaise: requestedTipAmountPaise,
      source: "booking_confirmation"
    },
    waitingChargesPaise: 0,
    grandTotalPaise: resolvedTaxPricing.totalAmountPaise + requestedTipAmountPaise,
    totalAmountPaise: resolvedTaxPricing.totalAmountPaise + requestedTipAmountPaise
  };
  const paymentAmountPaise = pricingBreakdown.grandTotalPaise;
  let requestedRazorpayPayment = metadata.razorpayPayment && typeof metadata.razorpayPayment === "object"
    ? metadata.razorpayPayment as Record<string, unknown>
    : null;
  let paymentType = normalizeCustomerPaymentType(metadata.paymentType);
  if (paymentType !== "razorpay" && !requestedRazorpayPayment) {
    const bookingReference = String(metadata.bookingReference || metadata.requestNumber || "").trim();
    const recoveredPayment = await findCustomerPaidRazorpayPaymentByReference({
      customerUserId: userId,
      bookingReference,
      amountPaise: paymentAmountPaise
    });
    if (recoveredPayment?.verified && recoveredPayment.paymentStatus === "paid") {
      requestedRazorpayPayment = recoveredPayment;
      paymentType = "razorpay";
      metadata.razorpayPayment = recoveredPayment;
      metadata.paymentType = "razorpay";
      metadata.paymentStatus = "paid";
      metadata.isPaid = true;
    }
  }
  if (!["cash", "razorpay"].includes(paymentType)) {
    throw new HttpError(400, "Selected payment method is not supported for booking confirmation.");
  }
  let validatedRazorpayPayment: Record<string, unknown> | null = null;
  if (paymentType === "razorpay") {
    const razorpayOrderId = String(
      requestedRazorpayPayment?.razorpayOrderId
      || requestedRazorpayPayment?.razorpay_order_id
      || ""
    ).trim();
    if (!razorpayOrderId) throw new HttpError(400, "Complete online payment before confirming booking.");
    const payment = await getCustomerRazorpayOrderStatus({ customerUserId: userId, orderId: razorpayOrderId });
    if (!payment.verified || payment.paymentStatus !== "paid") {
      throw new HttpError(409, "Online payment is not completed yet.");
    }
    if (Number(payment.amountPaise) !== paymentAmountPaise) {
      throw new HttpError(409, "Payment amount does not match the booking total.");
    }
    validatedRazorpayPayment = payment;
    metadata.razorpayPayment = payment;
    metadata.paymentStatus = "paid";
    metadata.isPaid = true;
  }
  const categoryBookingItem = selectedCategoryId ? {
    id: resolvedCategoryPrice.id || selectedCategoryId,
    itemType: "category",
    priceType: portalBookingText(selectedCartItem, "priceType") || "time",
    categoryId: selectedCategoryId,
    categoryName,
    categoryCode: resolvedCategoryPrice.categoryCode || category?.code || "",
    serviceId: selectedServiceId,
    serviceName,
    serviceMasterId: resolvedCategoryPrice.serviceMasterId || portalBookingText(selectedCartItem, "serviceMasterId"),
    serviceMasterName: resolvedCategoryPrice.serviceMasterName || portalBookingText(selectedCartItem, "serviceMasterName"),
    homeDisplayMode: resolvedCategoryPrice.homeDisplayMode || portalBookingText(selectedCartItem, "homeDisplayMode"),
    showInHomePage: resolvedCategoryPrice.showInHomePage ?? selectedCartItem?.showInHomePage ?? null,
    name: categoryName,
    imageUrl: resolvedCategoryPrice.categoryImageUrl || category?.imageUrl || "",
    categoryImageUrl: resolvedCategoryPrice.categoryImageUrl || category?.imageUrl || "",
    serviceImageUrl: portalBookingText(selectedCartItem, "serviceImageUrl"),
    durationMinutes,
    basePrice: selectedBasePrice,
    sellingPrice: selectedPrice,
    price: selectedPrice,
    saveAmount: Math.max(0, selectedBasePrice - selectedPrice),
    categoryPriceRuleId: resolvedCategoryPrice.id,
    durationLabel: resolvedCategoryPrice.label || portalBookingText(selectedCartItem, "durationLabel") || portalBookingText(selectedCartItem, "label"),
    allottedTime: portalBookingRecord(selectedCartItem?.allottedTime) || { enabled: true, durationMinutes },
    waitingCharge: resolvedCategoryPrice.waitingCharge
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
      paymentType,
      paymentStatus: paymentType === "razorpay" ? "paid" : String(metadata.paymentStatus || "due").toLowerCase(),
      isPaid: paymentType === "razorpay",
      cartItems: cleanCartItems,
      categoryBooking: categoryBookingItem,
      categoryId: selectedCategoryId,
      categoryName,
      serviceId: selectedServiceId,
      serviceName,
      serviceMasterId: categoryBookingItem && "serviceMasterId" in categoryBookingItem ? categoryBookingItem.serviceMasterId : portalBookingText(selectedCartItem, "serviceMasterId"),
      serviceMasterName: categoryBookingItem && "serviceMasterName" in categoryBookingItem ? categoryBookingItem.serviceMasterName : portalBookingText(selectedCartItem, "serviceMasterName"),
      homeDisplayMode: categoryBookingItem && "homeDisplayMode" in categoryBookingItem ? categoryBookingItem.homeDisplayMode : portalBookingText(selectedCartItem, "homeDisplayMode"),
      durationMinutes,
      bookingAmountPaise: paymentAmountPaise,
      paymentAmountPaise,
      pricingBreakdown,
      createdFrom: "customer_portal",
      cancelWindowMinutes: bookingType === "schedule" ? settings.customerCancelScheduleMinutes : settings.customerCancelInstantMinutes
    },
    actorUserId: userId
  });
  await clearCustomerPortalCart(userId);
  const razorpayPayment = validatedRazorpayPayment || (metadata.razorpayPayment && typeof metadata.razorpayPayment === "object"
    ? metadata.razorpayPayment as Record<string, unknown>
    : null);
  if (razorpayPayment && booking?.id) {
    const linkedPayment = await linkRazorpayPaymentToBooking({
      bookingId: booking.id,
      razorpayOrderId: String(razorpayPayment.razorpayOrderId || razorpayPayment.razorpay_order_id || ""),
      razorpayPaymentId: String(razorpayPayment.razorpayPaymentId || razorpayPayment.razorpay_payment_id || "")
    });
    if (!linkedPayment || linkedPayment.paymentStatus !== "paid") {
      throw new HttpError(500, "Booking was created but its successful online payment could not be linked. Please contact support.");
    }
  }
  const invoiceEmail = booking?.id
    ? await enqueueCustomerBookingInvoice(booking.id, userId).catch((error) => {
        console.error("Unable to queue customer booking invoice delivery", { bookingId: booking.id, userId, error });
        return { status: "failed", reason: "Invoice delivery could not be queued." };
      })
    : { status: "skipped", reason: "Booking was not created." };
  const persistedBooking = booking?.id
    ? await getCustomerPortalBooking(userId, booking.id)
    : booking;
  return { ...persistedBooking, invoiceEmail };
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
  try {
    const settings = await getBookingEngineSetting();
    if (!settings.customerPortal.isEnabled || !settings.customerPortal.allowBookService) throw new HttpError(403, "Customer booking is disabled.");
    await requireCustomerPortalCustomerId(userId);
    return await getBookingAvailabilityDecision({
      clusterId: input.clusterId,
      locationClusterIds: input.locationClusterIds || [],
      serviceId: input.serviceId ?? null,
      categoryId: input.categoryId ?? null,
      durationMinutes: Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30)))),
      waitWindowMinutes: 0,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null
    });
  } catch (error) {
    console.error("Unable to resolve customer booking availability.", {
      clusterId: input.clusterId,
      categoryId: input.categoryId,
      serviceId: input.serviceId,
      durationMinutes: input.durationMinutes,
      error
    });
    return {
      effectiveBookingType: "instant",
      bookingTypeMode: "both",
      assignType: "manual",
      instantMode: "manual",
      assignmentMode: "manual",
      assistantNextAvailableAt: null,
      assistantAvailableInMinutes: null,
      serviceWaitWindowMinutes: 0,
      finalAssistantAvailableAt: null,
      finalAssistantAvailableInMinutes: null,
      earliestPredictedAvailableAt: null,
      instantAllowed: false,
      instantAvailable: false,
      supplyAvailable: false,
      supplyUnavailable: true,
      autoHideUnavailable: true,
      supplyUnavailableReason: "availability_check_failed",
      instantSupplyUnavailable: true,
      instantSupplyUnavailableReason: "availability_check_failed",
      scheduleAllowed: false,
      estimatedReachMinutes: null,
      instantEstimatedAssignMinutes: null,
      instantWaitMinutes: null,
      instantWaitLimitMinutes: null,
      instantCapacityStartAt: null,
      instantCapacityEndAt: null,
      instantCapacityDurationMinutes: Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30)))),
      availabilityControls: {
        serviceOpen: false,
        instantServiceOpen: false,
        scheduleServiceOpen: false
      },
      scheduleDates: [],
      scheduleTimeSlots: [],
      scheduleAvailableSlots: [],
      scheduleAvailabilityChecked: true,
      eligibleAssistantCount: 0,
      onlineAssistantCount: 0,
      onlineFreeAssistantCount: 0,
      workingAssistantCount: 0,
      nextOnlineAssistantAvailableAt: null,
      earliestAssistantAvailableAt: null,
      unavailableReason: "availability_check_failed",
      config: {},
      scheduleConfig: {},
      automation: {}
    };
  }
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
      assignmentStatus: string | null;
      bookingStartAt: Date | null;
      scheduledAt: Date | null;
      createdAt: Date | null;
      actualTaskStartedAt: Date | null;
      assignmentActualStartedAt: Date | null;
      metadata: Record<string, unknown> | null;
    }>(
      `
        select sr.id as "bookingId", sr.accepted_assignment_id as "assignmentId",
          ta.assistant_id as "assistantId", sr.status_code as "statusCode",
          ta.status_code as "assignmentStatus",
          sr.booking_start_at as "bookingStartAt",
          sr.scheduled_at as "scheduledAt",
          sr.created_at as "createdAt",
          sr.actual_task_started_at as "actualTaskStartedAt",
          ta.actual_started_at as "assignmentActualStartedAt",
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
    const eligibility = customerBookingCancelEligibility(row, settings);
    if (!eligibility.canCancel) {
      throw new HttpError(409, "Cancellation is not available for this booking.");
    }
    const customerReason = String(input.reason || "").trim();
    const reason = eligibility.reasonCode === "customer_cancel_assistant_delay"
      ? "Assistant delay"
      : (customerReason || "Cancelled by customer");
    const cancelledAt = new Date();
    await client.query(
      `
        update zigo.service_requests
        set status_code = 'cancelled',
            cancelled_reason = $3,
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        row.bookingId,
        JSON.stringify({
          cancelledBy: "customer",
          cancelledAt: cancelledAt.toISOString(),
          cancellationReason: reason,
          customerCancellationNote: customerReason,
          cancellationReasonCode: eligibility.reasonCode,
          assistantId: row.assistantId,
          assignmentId: row.assignmentId,
          plannedStartAt: row.bookingStartAt ? new Date(row.bookingStartAt).toISOString() : null,
          delayMinutes: eligibility.delayMinutes,
          cancelOpensAt: eligibility.cancelOpensAt?.toISOString() ?? null,
          autoCancelAt: eligibility.autoCancelAt?.toISOString() ?? null
        }),
        reason
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
          customerCancellationNote: customerReason,
          cancellationReasonCode: eligibility.reasonCode,
          delayMinutes: eligibility.delayMinutes,
          cancelledAt: cancelledAt.toISOString()
        })
      ]
    );
    await releaseCapacityReservations(client, {
      serviceRequestId: row.bookingId,
      statusCode: "cancelled",
      reason: `Customer cancelled booking. ${reason}`
    });
    await client.query(
      `
        update zigo.booking_orchestration_state
        set demand_status = 'cancelled',
            risk_status = 'closed',
            supply_status = 'released',
            last_event_type = 'booking.cancelled',
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where service_request_id = $1
      `,
      [
        row.bookingId,
        JSON.stringify({
          cancelledBy: "customer",
          cancellationReason: reason,
          cancellationReasonCode: eligibility.reasonCode,
          delayMinutes: eligibility.delayMinutes,
          cancelledAt: cancelledAt.toISOString()
        })
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
        JSON.stringify({
          status: "cancelled",
          reason,
          customerCancellationNote: customerReason,
          reasonCode: eligibility.reasonCode,
          assistantId: row.assistantId,
          assignmentId: row.assignmentId,
          delayMinutes: eligibility.delayMinutes,
          cancelledAt: cancelledAt.toISOString()
        })
      ]
    );
    await client.query("commit");
    await stopAssistantCalendarBlocksForBooking({ bookingId: row.bookingId, status: "cancelled" }).catch((error) => {
      console.error("Unable to release assistant dispatch blocks for customer-cancelled booking.", error);
    });
    return { bookingId: row.bookingId, assignmentId: row.assignmentId, assistantId: row.assistantId, status: "cancelled", reasonCode: eligibility.reasonCode, delayMinutes: eligibility.delayMinutes };
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

    const result = await client.query(
      `
        select ta.id as "assignmentId", ta.status_code as "assignmentStatus", sr.id as "bookingId",
          sr.request_number as "requestNumber", sr.status_code as "bookingStatus", sr.notes,
          sr.duration_minutes as "durationMinutes", sr.estimated_amount_paise as "estimatedAmountPaise",
          sr.payment_type as "paymentType", sr.payment_status as "paymentStatus", sr.is_paid as "isPaid",
          coalesce(sr.payment_details, '{}'::jsonb) as "paymentDetails",
          sr.waiting_time_minutes as "waitingTimeMinutes", sr.waiting_charges_paise as "waitingChargesPaise",
          sr.metadata, coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
          sr.scheduled_at as "scheduledAt", sr.created_at as "createdAt",
          sr.booking_start_at as "bookingStartAt",
          sr.booking_end_at as "bookingEndAt",
          sr.booking_available_at as "bookingAvailableAt",
          sr.actual_task_started_at as "actualTaskStartedAt",
          ta.expires_at as "assignmentExpiresAt",
          ta.actual_started_at as "assignmentActualStartedAt",
          ta.offered_at as "assignmentOfferedAt", ta.assigned_at as "assignmentAssignedAt", ta.responded_at as "assignmentRespondedAt",
          u.display_name as "customerName", u.phone as "customerPhone",
          u.metadata->>'profilePictureUrl' as "customerProfilePictureUrl",
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
          and (
            sr.accepted_assignment_id = ta.id
            or lower(coalesce(ta.status_code, '')) in ('rejected', 'cancelled', 'canceled', 'completed')
          )
          and lower(coalesce(ta.status_code, '')) not in ('reassigned', 'reserved', 'offered', 'released')
        group by ta.id, sr.id, u.display_name, u.phone, u.metadata, s.name, c.name
        order by
          case
            when sr.status_code in ('assigned', 'queued', 'paid', 'payment_pending') or ta.status_code in ('assigned', 'accepted') then 1
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
    return result.rows.map((row) => ({
      ...row,
      metadata: withoutTaskPins(row.metadata),
      assignmentMetadata: withoutTaskPins(row.assignmentMetadata),
      taskUpdates: updates.get(row.bookingId) || []
    }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type AssistantPortalLocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  capturedAt?: string | null;
};

function portalLiveRouteCoordinate(input: Record<string, unknown> | null | undefined) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lng ?? input?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function portalDistanceMeters(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLng = toRad(destination.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function portalDistanceText(meters: number) {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters < 950) return `${Math.max(1, Math.round(meters))} m away`;
  return `${(meters / 1000).toFixed(meters < 9950 ? 1 : 0)} km away`;
}

function decodePortalPolyline(encoded: string) {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function portalRouteCoordinatesFromUnknown(value: unknown): Array<{ latitude: number; longitude: number }> {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return portalRouteCoordinatesFromUnknown(JSON.parse(value));
    } catch {
      try {
        return decodePortalPolyline(value).filter((point) => portalLiveRouteCoordinate(point));
      } catch {
        return [];
      }
    }
  }
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const direct = portalLiveRouteCoordinate(record);
      if (direct) return [direct];
      for (const key of [
        "coordinates",
        "points",
        "polyline",
        "encodedPolyline",
        "encoded_polyline",
        "overview_polyline",
        "overviewPolyline",
        "overview_path",
        "overviewPath",
        "geometry",
        "lineString",
        "linestring",
        "routePath",
        "path"
      ]) {
        const candidate = record[key];
        const points = portalRouteCoordinatesFromUnknown(
          key === "overview_polyline" && candidate && typeof candidate === "object" && "points" in (candidate as Record<string, unknown>)
            ? (candidate as Record<string, unknown>).points
            : candidate
        );
        if (points.length) return points;
      }
    }
    return [];
  }
  const points: Array<{ latitude: number; longitude: number }> = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      const point = portalLiveRouteCoordinate({ longitude: item[0], latitude: item[1] });
      if (point) points.push(point);
      continue;
    }
    const nested = portalRouteCoordinatesFromUnknown(item);
    if (nested.length) {
      points.push(...nested);
      continue;
    }
    if (item && typeof item === "object") {
      const point = portalLiveRouteCoordinate(item as Record<string, unknown>);
      if (point) points.push(point);
    }
  }
  return points;
}

function collectPortalRouteStepCoordinates(route: Record<string, any>) {
  const points: Array<{ latitude: number; longitude: number }> = [];
  const legs = Array.isArray(route.legs) ? route.legs : [];
  for (const leg of legs) {
    const steps = Array.isArray(leg?.steps) ? leg.steps : [];
    for (const step of steps) {
      const candidates = [
        step?.geometry,
        step?.polyline,
        step?.encodedPolyline,
        step?.encoded_polyline,
        step?.path,
        step?.routePath,
        step?.maneuver?.location,
        step?.start_location,
        step?.startLocation,
        step?.end_location,
        step?.endLocation
      ];
      for (const candidate of candidates) {
        const parsed = portalRouteCoordinatesFromUnknown(candidate);
        for (const point of parsed) points.push(point);
      }
    }
  }
  return points;
}

function dedupePortalRouteCoordinates(points: Array<{ latitude: number; longitude: number }>) {
  const unique: Array<{ latitude: number; longitude: number }> = [];
  for (const point of points) {
    const previous = unique[unique.length - 1];
    if (previous && Math.abs(previous.latitude - point.latitude) < 0.00001 && Math.abs(previous.longitude - point.longitude) < 0.00001) continue;
    unique.push(point);
  }
  return unique;
}

async function getPortalOlaAccessToken() {
  if (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET) return null;
  if (portalOlaAccessToken && portalOlaAccessToken.expiresAt > Date.now() + 30_000) return portalOlaAccessToken.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.OLA_MAPS_CLIENT_ID,
    client_secret: env.OLA_MAPS_CLIENT_SECRET
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(env.OLA_MAPS_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== "string") {
      portalOlaAccessToken = null;
      return null;
    }
    const expiresIn = Number(payload.expires_in ?? 300);
    portalOlaAccessToken = {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000
    };
    return portalOlaAccessToken.token;
  } catch {
    portalOlaAccessToken = null;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureAssistantLocationTrackingSchema(client: Queryable = pool) {
  await client.query(`
    alter table if exists zigo.assistant_availability
      add column if not exists latitude numeric(10,7),
      add column if not exists longitude numeric(10,7);

    create table if not exists zigo.assistant_location_pings (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      request_id uuid references zigo.service_requests(id) on delete set null,
      service_request_id uuid references zigo.service_requests(id) on delete set null,
      latitude numeric(10,7) not null,
      longitude numeric(10,7) not null,
      accuracy_meters numeric(8,2),
      captured_at timestamptz not null default now(),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    alter table if exists zigo.assistant_location_pings
      add column if not exists request_id uuid references zigo.service_requests(id) on delete set null,
      add column if not exists service_request_id uuid references zigo.service_requests(id) on delete set null,
      add column if not exists accuracy_meters numeric(8,2),
      add column if not exists captured_at timestamptz not null default now(),
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists zigo.assistant_location_pings
      alter column request_id drop not null,
      alter column service_request_id drop not null;

    create index if not exists idx_assistant_location_pings_assistant_created
      on zigo.assistant_location_pings (assistant_id, created_at desc);

    create index if not exists idx_assistant_location_pings_request
      on zigo.assistant_location_pings (service_request_id, created_at desc);
  `);
}

async function fetchPortalOlaRoute(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, waypoints: Array<{ latitude: number; longitude: number }> = []) {
  if (!env.OLA_MAPS_API_KEY && (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = new URL("https://api.olamaps.io/routing/v1/directions/basic");
    const token = await getPortalOlaAccessToken();
    url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
    url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("steps", "true");
    url.searchParams.set("overview", "full");
    if (waypoints.length) url.searchParams.set("waypoints", waypoints.map((point) => `${point.latitude},${point.longitude}`).join("|"));
    if (!token && env.OLA_MAPS_API_KEY) url.searchParams.set("api_key", env.OLA_MAPS_API_KEY);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Origin: env.CORS_ORIGIN === "*" ? `http://localhost:${env.PORT}` : env.CORS_ORIGIN,
        Referer: env.CORS_ORIGIN === "*" ? `http://localhost:${env.PORT}/` : `${env.CORS_ORIGIN.replace(/\/$/, "")}/`,
        "X-Request-Id": `zigo-route-${Date.now()}-${Math.random().toString(16).slice(2)}`
      },
      signal: controller.signal
    }).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, any> | null;
    const route = payload?.routes?.[0] || payload?.data?.routes?.[0] || payload?.route || payload?.data?.route || null;
    if (!route) return null;
    const legs = Array.isArray(route.legs) ? route.legs : [];
    const seconds = Number(route.duration ?? route.duration_seconds ?? route.durationInSeconds ?? route.duration_in_seconds ?? route.summary?.duration ?? route.summary?.durationSeconds ?? legs.reduce((sum: number, leg: any) => sum + Number(leg?.duration ?? leg?.duration_seconds ?? 0), 0));
    const meters = Number(route.distance ?? route.distance_meters ?? route.distanceInMeters ?? route.distance_in_meters ?? route.summary?.distance ?? route.summary?.distanceMeters ?? legs.reduce((sum: number, leg: any) => sum + Number(leg?.distance ?? leg?.distance_meters ?? 0), 0));
    const geometry = route.geometry?.coordinates
      || route.geometry
      || route.overview_polyline
      || route.overviewPolyline
      || route.overview_path
      || route.overviewPath
      || route.polyline
      || route.path
      || route.routePath
      || legs.flatMap((leg: any) => Array.isArray(leg.steps) ? leg.steps.map((step: any) => step.geometry || step.polyline || step.encodedPolyline || step.encoded_polyline || step.path).filter(Boolean) : []);
    const geometryPoints = portalRouteCoordinatesFromUnknown(geometry);
    const stepPoints = collectPortalRouteStepCoordinates(route);
    const routePath = dedupePortalRouteCoordinates(geometryPoints.length >= 2 ? geometryPoints : stepPoints);
    return {
      routePath: routePath.length >= 2 ? routePath : null,
      etaMinutes: Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : null,
      distanceMeters: Number.isFinite(meters) && meters > 0 ? meters : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function attachCustomerLiveRoutes(rows: Array<Record<string, any>>) {
  await ensureAssistantLocationTrackingSchema();
  const eligible = rows.filter((row) => {
    const status = String(row.statusCode || "").toLowerCase();
    return row.assistantId
      && (row.actualTaskStartedAt || row.assignmentActualStartedAt || ["working", "in_progress", "on_the_way", "approval_pending"].includes(status));
  });
  if (!eligible.length) return;
  const bookingIds = eligible.map((row) => row.id).filter(Boolean);
  const latestPings = await pool.query<{
    serviceRequestId: string;
    assistantId: string;
    latitude: string | number;
    longitude: string | number;
    accuracyMeters: string | number | null;
    capturedAt: Date;
  }>(
    `
      select distinct on (service_request_id)
        service_request_id as "serviceRequestId",
        assistant_id as "assistantId",
        latitude,
        longitude,
        accuracy_meters as "accuracyMeters",
        captured_at as "capturedAt"
      from zigo.assistant_location_pings
      where service_request_id = any($1::uuid[])
      order by service_request_id, captured_at desc, created_at desc
    `,
    [bookingIds]
  );
  const pingByBooking = new Map(latestPings.rows.map((row) => [row.serviceRequestId, row]));
  const assistantIds = [...new Set(eligible.map((row) => String(row.assistantId || "").trim()).filter(Boolean))];
  const latestAssistantPings = assistantIds.length ? await pool.query<{
    assistantId: string;
    latitude: string | number;
    longitude: string | number;
    accuracyMeters: string | number | null;
    capturedAt: Date;
  }>(
    `
      select distinct on (assistant_id)
        assistant_id as "assistantId",
        latitude,
        longitude,
        accuracy_meters as "accuracyMeters",
        captured_at as "capturedAt"
      from zigo.assistant_location_pings
      where assistant_id = any($1::uuid[])
      order by assistant_id, captured_at desc, created_at desc
    `,
    [assistantIds]
  ) : { rows: [] };
  const availabilityPoints = assistantIds.length ? await pool.query<{
    assistantId: string;
    latitude: string | number;
    longitude: string | number;
    capturedAt: Date;
  }>(
    `
      select assistant_id as "assistantId",
        latitude,
        longitude,
        updated_at as "capturedAt"
      from zigo.assistant_availability
      where assistant_id = any($1::uuid[])
        and latitude is not null
        and longitude is not null
    `,
    [assistantIds]
  ) : { rows: [] };
  const pingByAssistant = new Map(latestAssistantPings.rows.map((row) => [row.assistantId, row]));
  const availabilityByAssistant = new Map(availabilityPoints.rows.map((row) => [row.assistantId, row]));
  for (const row of eligible) {
    const routeLocations = (Array.isArray(row.locations) ? row.locations : [])
      .map((location) => portalLiveRouteCoordinate(location))
      .filter((point): point is { latitude: number; longitude: number } => Boolean(point));
    const destination = routeLocations[routeLocations.length - 1] || null;
    const assistantId = String(row.assistantId || "").trim();
    const ping = pingByBooking.get(row.id) || pingByAssistant.get(assistantId) || availabilityByAssistant.get(assistantId);
    const assistantLocation = portalLiveRouteCoordinate(ping || null);
    if (!destination) continue;
    if (!assistantLocation) {
      row.liveRoute = {
        status: "waiting_for_assistant_location",
        assistantLocation: null,
        destinationLocation: destination,
        stopLocations: routeLocations,
        routePath: null,
        routePolyline: null,
        etaMinutes: null,
        distanceText: "",
        updatedAt: new Date().toISOString()
      };
      continue;
    }
    const pingRecord = (ping || {}) as Record<string, any>;
    const fallbackPath = [assistantLocation, ...routeLocations];
    const directMeters = fallbackPath.slice(1).reduce((total, point, index) => total + portalDistanceMeters(fallbackPath[index], point), 0);
    const intermediateWaypoints = routeLocations.slice(0, -1);
    const route = await fetchPortalOlaRoute(assistantLocation, destination, intermediateWaypoints);
    const distanceMeters = route?.distanceMeters || directMeters;
    row.liveRoute = {
      status: route?.routePath?.length ? "live" : "route_pending",
      assistantLocation: {
        ...assistantLocation,
        accuracy: pingRecord.accuracyMeters ?? null,
        capturedAt: ping?.capturedAt ? new Date(ping.capturedAt).toISOString() : null
      },
      destinationLocation: destination,
      stopLocations: routeLocations,
      routePath: route?.routePath || null,
      routePolyline: route?.routePath || null,
      etaMinutes: route?.etaMinutes || Math.max(1, Math.ceil((distanceMeters / 1000) / 18 * 60)),
      distanceText: portalDistanceText(distanceMeters),
      updatedAt: ping?.capturedAt ? new Date(ping.capturedAt).toISOString() : new Date().toISOString()
    };
  }
}

export async function setAssistantPortalOnline(userId: string, isOnline: boolean, location?: AssistantPortalLocationInput) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled || !settings.assistantPortal.allowGoOnline) throw new HttpError(403, "Assistant online control is disabled.");
  await ensureAssistantLocationTrackingSchema();
  const assistant = await pool.query<{ id: string }>("select id from zigo.assistants where user_id = $1 limit 1", [userId]);
  if (!assistant.rows[0]) throw new HttpError(404, "Assistant profile not found.");
  const point = portalLiveRouteCoordinate(location as Record<string, unknown>);
  if (isOnline && !point) throw new HttpError(400, "Current GPS location is required to go online.");
  const data = await updateAssistantAvailability({ assistantId: assistant.rows[0].id, isOnline, actorUserId: userId });
  const dispatchState = isOnline
    ? await goAssistantOnline({ assistantId: assistant.rows[0].id, location: location ?? {}, actorUserId: userId })
    : await goAssistantOffline({ assistantId: assistant.rows[0].id, reason: "assistant_portal" });
  if (point) {
    await pool.query(
      `
        update zigo.assistant_availability
        set latitude = $2,
            longitude = $3,
            updated_at = now()
        where assistant_id = $1
      `,
      [assistant.rows[0].id, point.latitude, point.longitude]
    );
  }
  return { ...data, dispatch: dispatchState, ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}) };
}

export async function recordAssistantPortalLocationPing(userId: string, input: AssistantPortalLocationInput) {
  await ensureAssistantLocationTrackingSchema();
  const point = portalLiveRouteCoordinate(input as Record<string, unknown>);
  if (!point) throw new HttpError(400, "Latitude and longitude are required.");
  const assistant = await pool.query<{ id: string }>("select id from zigo.assistants where user_id = $1 limit 1", [userId]);
  if (!assistant.rows[0]) throw new HttpError(404, "Assistant profile not found.");
  const active = await pool.query<{ bookingId: string | null; assignmentId: string | null }>(
    `
      select sr.id as "bookingId", ta.id as "assignmentId"
      from zigo.task_assignments ta
      join zigo.service_requests sr on sr.id = ta.service_request_id
      where ta.assistant_id = $1
        and lower(coalesce(ta.status_code, '')) in ('assigned', 'accepted', 'in_progress', 'working', 'approval_pending')
        and lower(coalesce(sr.status_code, '')) not in ('completed', 'success', 'done', 'cancelled', 'canceled', 'failed', 'rejected', 'expired')
      order by case when lower(coalesce(ta.status_code, '')) in ('in_progress', 'working') then 0 else 1 end,
        ta.assigned_at desc nulls last
      limit 1
    `,
    [assistant.rows[0].id]
  );
  const bookingId = active.rows[0]?.bookingId || null;
  const capturedAt = input.capturedAt ? new Date(input.capturedAt) : new Date();
  const accuracy = Number(input.accuracy);
  const saved = await pool.query(
    `
      insert into zigo.assistant_location_pings
        (assistant_id, request_id, service_request_id, latitude, longitude, accuracy_meters, captured_at, metadata)
      values ($1, $2, $2, $3, $4, $5, $6, $7::jsonb)
      returning id, assistant_id as "assistantId", service_request_id as "bookingId", latitude, longitude, accuracy_meters as "accuracyMeters", captured_at as "capturedAt"
    `,
    [
      assistant.rows[0].id,
      bookingId,
      point.latitude,
      point.longitude,
      Number.isFinite(accuracy) ? accuracy : null,
      Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
      JSON.stringify({ source: "assistant_portal" })
    ]
  );
  await pool.query(
    `
      update zigo.assistant_availability
      set latitude = $2,
          longitude = $3,
          heartbeat_at = now(),
          gps_captured_at = $4,
          presence_status = case when presence_status = 'OFFLINE' then 'ONLINE' else coalesce(presence_status, 'ONLINE') end,
          updated_at = now()
      where assistant_id = $1
    `,
    [assistant.rows[0].id, point.latitude, point.longitude, Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt]
  );
  await recordAssistantHeartbeat({
    assistantId: assistant.rows[0].id,
    location: {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt
    }
  });
  return {
    ...saved.rows[0],
    assignmentId: active.rows[0]?.assignmentId || null
  };
}

export async function updateAssistantPortalTaskStatus(userId: string, input: { assignmentId: string; status: "accepted" | "in_progress" | "completed" | "rejected"; pin?: string }) {
  const settings = await getBookingEngineSetting();
  if (!settings.assistantPortal.isEnabled || !settings.assistantPortal.allowTaskExecution) throw new HttpError(403, "Assistant task execution is disabled.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    await ensurePortalSchema(client);
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
      bookingStartAt: Date | null;
      bookingEndAt: Date | null;
      bookingAvailableAt: Date | null;
      wrapUpMinutes: number | null;
      travelBufferMinutes: number | null;
      actualTaskStartedAt: Date | null;
      assistantStartDelayMinutes: number | null;
      bookingDelayCreditMinutes: number | null;
      assignmentActualStartedAt: Date | null;
      assignmentStartDelayMinutes: number | null;
      assignmentDelayCreditMinutes: number | null;
      bookingMetadata: Record<string, any> | null;
      assignmentMetadata: Record<string, any> | null;
      assignmentRespondedAt: string | null;
    }>(
      `
        select sr.id as "bookingId", a.id as "assistantId", cu.user_id as "customerUserId",
          sr.duration_minutes as "durationMinutes", sr.status_code as "bookingStatus", ta.status_code as "assignmentStatus",
          sr.booking_amount_paise as "bookingAmountPaise", sr.waiting_time_minutes as "waitingTimeMinutes",
          sr.waiting_charges_paise as "waitingChargesPaise",
          sr.booking_start_at as "bookingStartAt",
          sr.booking_end_at as "bookingEndAt",
          sr.booking_available_at as "bookingAvailableAt",
          sr.wrap_up_minutes as "wrapUpMinutes",
          sr.travel_buffer_minutes as "travelBufferMinutes",
          sr.actual_task_started_at as "actualTaskStartedAt",
          sr.assistant_start_delay_minutes as "assistantStartDelayMinutes",
          sr.delay_credit_minutes as "bookingDelayCreditMinutes",
          ta.actual_started_at as "assignmentActualStartedAt",
          ta.start_delay_minutes as "assignmentStartDelayMinutes",
          ta.delay_credit_minutes as "assignmentDelayCreditMinutes",
          coalesce(sr.metadata, '{}'::jsonb) as "bookingMetadata",
          coalesce(ta.metadata, '{}'::jsonb) as "assignmentMetadata",
          ta.responded_at as "assignmentRespondedAt"
        from zigo.task_assignments ta
        join zigo.assistants a on a.id = ta.assistant_id
        join zigo.service_requests sr on sr.id = ta.service_request_id
        left join zigo.customers cu on cu.id = sr.customer_id
        where ta.id = $1 and a.user_id = $2
        limit 1
        for update of ta, sr
      `,
      [input.assignmentId, userId]
    );
    if (!assignment.rows[0]) throw new HttpError(404, "Task not found.");
    const current = assignment.rows[0];
    const now = new Date();
    const bookingPins = taskPinsFromMetadata(current.bookingMetadata);
    const assignmentPins = taskPinsFromMetadata(current.assignmentMetadata);
    const mergedPins = {
      ...bookingPins,
      ...Object.fromEntries(Object.entries(assignmentPins).filter(([, value]) => value !== "" && value !== undefined && value !== null))
    };
    const startPinCandidates = [
      ...taskPinCandidatesFromMetadata(current.bookingMetadata, "startPin"),
      ...taskPinCandidatesFromMetadata(current.assignmentMetadata, "startPin")
    ].filter((value, index, values) => values.indexOf(value) === index);
    const finishPinCandidates = [
      ...taskPinCandidatesFromMetadata(current.bookingMetadata, "finishPin"),
      ...taskPinCandidatesFromMetadata(current.assignmentMetadata, "finishPin")
    ].filter((value, index, values) => values.indexOf(value) === index);
    const suppliedPin = String(input.pin || "").trim();
    if (input.status === "in_progress") {
      if (!/^\d{4}$/.test(suppliedPin)) throw new HttpError(400, "Ask customer to share 4 digit PIN to start.");
      if (!startPinCandidates.length) throw new HttpError(409, "Start PIN is not ready. Ask customer to reopen Track Booking.");
      if (!startPinCandidates.includes(suppliedPin)) throw new HttpError(403, "Invalid Start PIN.");
      mergedPins.startPin = mergedPins.startPin || suppliedPin;
    }
    if (input.status === "completed") {
      if (!/^\d{4}$/.test(suppliedPin)) throw new HttpError(400, "Ask customer to share 4 digit PIN to finish.");
      if (!finishPinCandidates.length) throw new HttpError(409, "Finish PIN is not ready. Start the task first.");
      if (!finishPinCandidates.includes(suppliedPin)) throw new HttpError(403, "Invalid Finish PIN.");
      mergedPins.finishPin = mergedPins.finishPin || suppliedPin;
      const completedAt = now;
      const finishedStartAt = validDateFromUnknown(current.assignmentActualStartedAt)
        ?? validDateFromUnknown(current.actualTaskStartedAt)
        ?? validDateFromUnknown(current.assignmentMetadata?.actualStartedAt)
        ?? validDateFromUnknown(current.bookingMetadata?.actualStartedAt)
        ?? validDateFromUnknown(current.assignmentMetadata?.startedAt)
        ?? validDateFromUnknown(current.bookingMetadata?.startedAt)
        ?? now;
      const finishedDurationMinutes = Math.max(1, Number(current.durationMinutes || current.assignmentMetadata?.durationMinutes || current.bookingMetadata?.durationMinutes || 30));
      const plannedTaskEndAt = addMinutes(finishedStartAt, finishedDurationMinutes) ?? completedAt;
      const configuredFinishBufferMinutes = Math.max(0,
        Math.round(Number(
          current.wrapUpMinutes
          ?? current.bookingMetadata?.wrapUpMinutes
          ?? current.assignmentMetadata?.wrapUpMinutes
          ?? 0
        )) + Math.round(Number(
          current.travelBufferMinutes
          ?? current.bookingMetadata?.travelBufferMinutes
          ?? current.assignmentMetadata?.travelBufferMinutes
          ?? 0
        ))
      );
      const currentFinishAvailableAt = validDateFromUnknown(current.bookingAvailableAt)
        ?? validDateFromUnknown(current.assignmentMetadata?.bookingAvailableAt)
        ?? validDateFromUnknown(current.assignmentMetadata?.expectedFreeAt)
        ?? plannedTaskEndAt;
      const persistedFinishBufferMinutes = Math.max(0, Math.ceil((currentFinishAvailableAt.getTime() - plannedTaskEndAt.getTime()) / 60_000));
      const finishBufferMinutes = configuredFinishBufferMinutes > 0 ? configuredFinishBufferMinutes : persistedFinishBufferMinutes;
      const actualTaskEndAt = completedAt;
      const actualAvailableAt = addMinutes(actualTaskEndAt, finishBufferMinutes) ?? actualTaskEndAt;
      const earlyFinishMinutes = Math.max(0, Math.ceil((plannedTaskEndAt.getTime() - completedAt.getTime()) / 60_000));
      const lateFinishMinutes = Math.max(0, Math.ceil((completedAt.getTime() - plannedTaskEndAt.getTime()) / 60_000));
      const finishMetadata = {
        finishPinVerifiedAt: completedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        plannedTaskEndAt: plannedTaskEndAt.toISOString(),
        actualTaskEndAt: actualTaskEndAt.toISOString(),
        taskEndAt: actualTaskEndAt.toISOString(),
        bookingEndAt: actualTaskEndAt.toISOString(),
        bookingAvailableAt: actualAvailableAt.toISOString(),
        expectedFreeAt: actualAvailableAt.toISOString(),
        earlyFinishMinutes,
        lateFinishMinutes,
        finishAdjustmentMinutes: earlyFinishMinutes > 0 ? -earlyFinishMinutes : lateFinishMinutes,
        bufferMinutes: finishBufferMinutes,
        timerStatus: "completed",
        taskTimer: {
          status: "completed",
          startedAt: finishedStartAt.toISOString(),
          actualStartedAt: finishedStartAt.toISOString(),
          plannedTaskEndAt: plannedTaskEndAt.toISOString(),
          taskEndAt: actualTaskEndAt.toISOString(),
          completedAt: completedAt.toISOString(),
          earlyFinishMinutes,
          lateFinishMinutes,
          expectedFreeAt: actualAvailableAt.toISOString(),
          durationMinutes: finishedDurationMinutes,
          taskTotalMinutes: finishedDurationMinutes,
          bufferMinutes: finishBufferMinutes
        },
        taskPins: {
          ...mergedPins,
          finishPinVerifiedAt: completedAt.toISOString()
        }
      };
      await client.query(
        `
          update zigo.task_assignments
          set status_code = 'completed',
              responded_at = coalesce(responded_at, now()),
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1
        `,
        [input.assignmentId, JSON.stringify(finishMetadata)]
      );
      await client.query(
        `
          update zigo.service_requests
          set status_code = 'completed',
              completed_at = coalesce(completed_at, $3),
              booking_end_at = $4,
              booking_available_at = $5,
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
          where id = $1
        `,
        [current.bookingId, JSON.stringify(finishMetadata), completedAt, actualTaskEndAt, actualAvailableAt]
      );
      await client.query(
        `
          update zigo.assistant_capacity_reservations
          set reserved_until = $2::timestamptz,
              status_code = case when $2::timestamptz <= now() then 'completed' else status_code end,
              released_at = case when $2::timestamptz <= now() then now() else released_at end,
              release_reason = case
                when $2::timestamptz <= now() then 'Task completed'
                when $3::int > 0 then 'Task completed early, capacity held until adjusted available time'
                when $4::int > 0 then 'Task completed late, capacity held until adjusted available time'
                else 'Task completed, capacity held until available time'
              end,
              updated_at = now(),
              metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb
          where assignment_id = $1
            and status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        `,
        [input.assignmentId, actualAvailableAt, earlyFinishMinutes, lateFinishMinutes, JSON.stringify({
          completedAt: completedAt.toISOString(),
          actualTaskEndAt: actualTaskEndAt.toISOString(),
          plannedTaskEndAt: plannedTaskEndAt.toISOString(),
          bookingAvailableAt: actualAvailableAt.toISOString(),
          expectedFreeAt: actualAvailableAt.toISOString(),
          earlyFinishMinutes,
          lateFinishMinutes,
          releaseReason: "Task completed",
          capacityHeldUntilAvailableAt: true
        })]
      );
      await client.query(
        `
          update zigo.booking_orchestration_state
          set demand_status = 'completed',
              risk_status = 'closed',
              supply_status = 'released',
              next_check_at = $3,
              last_event_type = 'assistant.completed_task',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
          where service_request_id = $1
        `,
        [current.bookingId, JSON.stringify({
          assignmentId: input.assignmentId,
          assistantId: current.assistantId,
          completedAt: completedAt.toISOString(),
          plannedTaskEndAt: plannedTaskEndAt.toISOString(),
          actualTaskEndAt: actualTaskEndAt.toISOString(),
          bookingAvailableAt: actualAvailableAt.toISOString(),
          earlyFinishMinutes,
          lateFinishMinutes
        }), actualAvailableAt]
      );
      await client.query(
        `
          insert into zigo.booking_task_updates
            (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
          values ($1, $2, $3, 'assistant', 'status', 'Task completed.', '[]'::jsonb, $4::jsonb)
        `,
        [current.bookingId, input.assignmentId, userId, JSON.stringify(finishMetadata)]
      );
      await setAssistantAvailabilityForPortalTask(client, current.assistantId, "completed");
      await client.query("commit");
      return {
        assignmentId: input.assignmentId,
        bookingId: current.bookingId,
        assistantId: current.assistantId,
        customerUserId: current.customerUserId,
        status: "completed",
        completedAt: completedAt.toISOString(),
        bookingEndAt: actualTaskEndAt.toISOString(),
        bookingAvailableAt: actualAvailableAt.toISOString(),
        expectedFreeAt: actualAvailableAt.toISOString(),
        earlyFinishMinutes,
        lateFinishMinutes
      };
    }
    const bookingStatus = input.status === "in_progress" ? "in_progress" : input.status === "rejected" ? "rejected" : "accepted";
    const wasAlreadyStarted = Boolean(current.assignmentActualStartedAt || current.actualTaskStartedAt || current.assignmentStatus === "in_progress");
    const plannedStartAt = validDateFromUnknown(current.bookingStartAt)
      ?? validDateFromUnknown(current.assignmentMetadata?.startsAt)
      ?? validDateFromUnknown(current.bookingMetadata?.bookingStartAt)
      ?? validDateFromUnknown(current.bookingMetadata?.startAt);
    const durationMinutes = Math.max(1, Number(current.durationMinutes || current.assignmentMetadata?.durationMinutes || current.bookingMetadata?.durationMinutes || 30));
    const configuredBufferMinutes = Math.max(0,
      Math.round(Number(
        current.wrapUpMinutes
        ?? current.bookingMetadata?.wrapUpMinutes
        ?? current.assignmentMetadata?.wrapUpMinutes
        ?? 0
      )) + Math.round(Number(
        current.travelBufferMinutes
        ?? current.bookingMetadata?.travelBufferMinutes
        ?? current.assignmentMetadata?.travelBufferMinutes
        ?? 0
      ))
    );
    const currentTaskEndAt = validDateFromUnknown(current.bookingEndAt)
      ?? validDateFromUnknown(current.assignmentMetadata?.taskEndAt)
      ?? addMinutes(plannedStartAt, durationMinutes)
      ?? addMinutes(now, durationMinutes)!;
    const currentAvailableAt = validDateFromUnknown(current.bookingAvailableAt)
      ?? validDateFromUnknown(current.assignmentMetadata?.bookingAvailableAt)
      ?? validDateFromUnknown(current.assignmentMetadata?.expectedFreeAt)
      ?? currentTaskEndAt;
    const actualStartedAt = current.assignmentActualStartedAt ?? current.actualTaskStartedAt ?? now;
    const persistedBufferMinutes = Math.max(0, Math.ceil((currentAvailableAt.getTime() - currentTaskEndAt.getTime()) / 60_000));
    const bufferMinutes = configuredBufferMinutes > 0 ? configuredBufferMinutes : persistedBufferMinutes;
    const delayMinutes = input.status === "in_progress"
      ? (wasAlreadyStarted
        ? Math.max(0, Number(current.assignmentStartDelayMinutes ?? current.assistantStartDelayMinutes ?? current.assignmentMetadata?.startDelayMinutes ?? 0))
        : ceilPositiveMinutes(plannedStartAt, actualStartedAt))
      : 0;
    const delayCreditMinutes = input.status === "in_progress"
      ? (wasAlreadyStarted
        ? Math.max(0, Number(current.assignmentDelayCreditMinutes ?? current.bookingDelayCreditMinutes ?? current.assignmentMetadata?.delayCreditMinutes ?? delayMinutes))
        : delayMinutes)
      : 0;
    const extendedTaskEndAt = input.status === "in_progress" && !wasAlreadyStarted
      ? addMinutes(actualStartedAt, durationMinutes)!
      : currentTaskEndAt;
    const extendedAvailableAt = input.status === "in_progress" && !wasAlreadyStarted
      ? addMinutes(extendedTaskEndAt, bufferMinutes)!
      : currentAvailableAt;
    const finishPinForStart = input.status === "in_progress" ? (mergedPins.finishPin || generateTaskPin()) : mergedPins.finishPin;
    const statusMetadata = input.status === "in_progress"
      ? {
        startedAt: actualStartedAt.toISOString(),
        plannedStartAt: plannedStartAt?.toISOString() ?? null,
        actualStartedAt: actualStartedAt.toISOString(),
        startDelayMinutes: delayMinutes,
        delayCreditMinutes,
        plannedEndAt: currentTaskEndAt.toISOString(),
        actualTaskEndAt: extendedTaskEndAt.toISOString(),
        taskEndAt: extendedTaskEndAt.toISOString(),
        bookingEndAt: currentTaskEndAt.toISOString(),
        bookingAvailableAt: extendedAvailableAt.toISOString(),
        expectedFreeAt: extendedAvailableAt.toISOString(),
        durationMinutes,
        bufferMinutes,
        wrapUpMinutes: Math.max(0, Math.round(Number(current.wrapUpMinutes ?? current.bookingMetadata?.wrapUpMinutes ?? current.assignmentMetadata?.wrapUpMinutes ?? 0))),
        travelBufferMinutes: Math.max(0, Math.round(Number(current.travelBufferMinutes ?? current.bookingMetadata?.travelBufferMinutes ?? current.assignmentMetadata?.travelBufferMinutes ?? 0))),
        timerStatus: "running",
        taskPins: {
          ...mergedPins,
          finishPin: finishPinForStart,
          startPinVerifiedAt: actualStartedAt.toISOString(),
          finishPinGeneratedAt: mergedPins.finishPinGeneratedAt || actualStartedAt.toISOString()
        },
        taskTimer: {
          status: "running",
          plannedStartAt: plannedStartAt?.toISOString() ?? null,
          startedAt: actualStartedAt.toISOString(),
          actualStartedAt: actualStartedAt.toISOString(),
          startDelayMinutes: delayMinutes,
          delayCreditMinutes,
          plannedEndAt: currentTaskEndAt.toISOString(),
          actualTaskEndAt: extendedTaskEndAt.toISOString(),
          taskEndAt: extendedTaskEndAt.toISOString(),
          expectedFreeAt: extendedAvailableAt.toISOString(),
          taskTotalMinutes: durationMinutes,
          durationMinutes,
          bufferMinutes
        }
      }
      : {};
    if (input.status === "in_progress") {
      await client.query(
        `
          update zigo.task_assignments
          set status_code = $2,
              responded_at = coalesce(responded_at, now()),
              actual_started_at = coalesce(actual_started_at, $4),
              start_delay_minutes = case when actual_started_at is null then $5 else start_delay_minutes end,
              delay_credit_minutes = case when actual_started_at is null then $6 else delay_credit_minutes end,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where id = $1
        `,
        [input.assignmentId, input.status, JSON.stringify(statusMetadata), actualStartedAt, delayMinutes, delayCreditMinutes]
      );
      await client.query(
        `
          update zigo.service_requests
          set status_code = $2::text,
              actual_task_started_at = coalesce(actual_task_started_at, $4),
              assistant_start_delay_minutes = case when actual_task_started_at is null then $5 else assistant_start_delay_minutes end,
              delay_credit_minutes = case when actual_task_started_at is null then $6 else delay_credit_minutes end,
              booking_available_at = $7,
              booking_end_at = $8,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
          where id = $1
        `,
        [
          current.bookingId,
          bookingStatus,
          JSON.stringify(statusMetadata),
          actualStartedAt,
          delayMinutes,
          delayCreditMinutes,
          extendedAvailableAt,
          extendedTaskEndAt
        ]
      );
      await client.query(
        `
          update zigo.assistant_capacity_reservations
          set reserved_until = $2::timestamptz,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
          where assignment_id = $1
            and status_code in ('held', 'reserved', 'assigned', 'accepted', 'in_progress')
        `,
        [
          input.assignmentId,
          extendedAvailableAt,
          JSON.stringify({
            actualStartedAt: actualStartedAt.toISOString(),
            plannedStartAt: plannedStartAt?.toISOString() ?? null,
            startDelayMinutes: delayMinutes,
            delayCreditMinutes,
            taskEndAt: extendedTaskEndAt.toISOString(),
            bookingAvailableAt: extendedAvailableAt.toISOString(),
            expectedFreeAt: extendedAvailableAt.toISOString(),
            durationMinutes,
            bufferMinutes,
            wrapUpMinutes: Math.max(0, Math.round(Number(current.wrapUpMinutes ?? current.bookingMetadata?.wrapUpMinutes ?? current.assignmentMetadata?.wrapUpMinutes ?? 0))),
            travelBufferMinutes: Math.max(0, Math.round(Number(current.travelBufferMinutes ?? current.bookingMetadata?.travelBufferMinutes ?? current.assignmentMetadata?.travelBufferMinutes ?? 0)))
          })
        ]
      );
      await client.query(
        `
          update zigo.booking_orchestration_state
          set supply_status = 'working',
              risk_status = case when $2::int > 0 then 'delayed' else risk_status end,
              next_check_at = $3,
              last_event_type = 'assistant.started_task',
              metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
              updated_at = now()
          where service_request_id = $1
        `,
        [
          current.bookingId,
          delayMinutes,
          extendedAvailableAt,
          JSON.stringify({
            assignmentId: input.assignmentId,
            assistantId: current.assistantId,
            plannedStartAt: plannedStartAt?.toISOString() ?? null,
            actualStartedAt: actualStartedAt.toISOString(),
            startDelayMinutes: delayMinutes,
            delayCreditMinutes,
            taskEndAt: extendedTaskEndAt.toISOString(),
            bookingAvailableAt: extendedAvailableAt.toISOString()
          })
        ]
      );
      if (!wasAlreadyStarted) {
        await client.query(
          `
            insert into zigo.assistant_delay_credits
              (service_request_id, task_assignment_id, assistant_id, planned_start_at, actual_started_at,
               delay_minutes, credited_minutes, source, metadata, created_by_user_id)
            values ($1, $2, $3, $4, $5, $6, $7, 'assistant_start', $8::jsonb, $9)
            on conflict (task_assignment_id) do nothing
          `,
          [
            current.bookingId,
            input.assignmentId,
            current.assistantId,
            plannedStartAt,
            actualStartedAt,
            delayMinutes,
            delayCreditMinutes,
            JSON.stringify({
              taskEndAt: extendedTaskEndAt.toISOString(),
              bookingAvailableAt: extendedAvailableAt.toISOString(),
              expectedFreeAt: extendedAvailableAt.toISOString()
            }),
            userId
          ]
        );
        await client.query(
          `
            insert into zigo.booking_task_updates
              (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
            values ($1, $2, $3, 'assistant', 'status', $4, '[]'::jsonb, $5::jsonb)
          `,
          [
            current.bookingId,
            input.assignmentId,
            userId,
            delayMinutes > 0 ? `Task started with ${delayMinutes} minute delay.` : "Task started.",
            JSON.stringify(statusMetadata)
          ]
        );
      }
    } else {
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
    }
    await setAssistantAvailabilityForPortalTask(client, current.assistantId, input.status);
    if (input.status === "rejected") {
      await client.query(
        "update zigo.assistant_capacity_reservations set status_code = 'released', updated_at = now() where assignment_id = $1 and status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')",
        [input.assignmentId]
      );
    }
    await client.query("commit");
    return {
      assignmentId: input.assignmentId,
      bookingId: current.bookingId,
      assistantId: current.assistantId,
      customerUserId: current.customerUserId,
      status: input.status,
      startDelayMinutes: input.status === "in_progress" ? delayMinutes : undefined,
      delayCreditMinutes: input.status === "in_progress" ? delayCreditMinutes : undefined,
      actualStartedAt: input.status === "in_progress" ? actualStartedAt.toISOString() : undefined,
      bookingEndAt: input.status === "in_progress" ? extendedTaskEndAt.toISOString() : undefined,
      bookingAvailableAt: input.status === "in_progress" ? extendedAvailableAt.toISOString() : undefined,
      expectedFreeAt: input.status === "in_progress" ? extendedAvailableAt.toISOString() : undefined
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
  const mediaCount = Array.isArray(input.mediaUrls) ? input.mediaUrls.length : 0;
  const updateType: TaskUpdateType = input.updateType === "text" && mediaCount > 0 ? "file" : input.updateType;
  const actorSettings = input.actor === "customer" ? settings.customerPortal : settings.assistantPortal;
  if (updateType === "text" && !actorSettings.allowTextUpdates) throw new HttpError(403, `${input.actor === "customer" ? "Customer" : "Assistant"} text updates are disabled.`);
  if (["image", "video", "file"].includes(updateType) && !actorSettings.allowImageUpdates) throw new HttpError(403, `${input.actor === "customer" ? "Customer" : "Assistant"} attachment updates are disabled.`);
  if (updateType === "voice" && !actorSettings.allowVoiceUpdates) throw new HttpError(403, `${input.actor === "customer" ? "Customer" : "Assistant"} voice updates are disabled.`);
  if (["status", "location", "payment_request", "payment_received", "approval_request", "time_extension_request", "time_extension_approved"].includes(updateType) && input.actor === "assistant" && !settings.assistantPortal.allowTaskExecution) {
    throw new HttpError(403, "Assistant task execution is disabled.");
  }
  if (updateType === "approval_response" && input.actor === "customer" && !settings.customerPortal.allowTextUpdates) {
    throw new HttpError(403, "Customer approval updates are disabled.");
  }
  if (updateType === "payment_response" && input.actor === "customer" && !settings.customerPortal.allowTextUpdates) {
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
      updateType,
      input.message ?? null,
      JSON.stringify(input.mediaUrls || []),
      JSON.stringify(input.metadata || {})
    ]
  );
  if (updateType === "payment_response" && input.actor === "customer") {
    const paidAt = new Date();
    const metadata = input.metadata || {};
    const amount = Number(metadata.amount || 0);
    const mode = String(metadata.mode || metadata.paymentMode || "online").toLowerCase();
    const remarks = String(metadata.remarks || metadata.transactionId || metadata.referenceId || metadata.note || "").trim();
    const referenceId = String(metadata.referenceId || metadata.transactionId || "").trim();
    const note = String(metadata.note || "").trim();
    const confirmationTarget = mode === "cash" ? "assistant" : "admin";
    const proofMediaUrls = input.mediaUrls || [];
    await pool.query(
      `
        update zigo.service_requests
        set payment_status = case when payment_status = 'paid' then payment_status else 'pending' end,
            payment_type = $4,
            payment_details = coalesce(payment_details, '{}'::jsonb) || $2::jsonb,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        input.bookingId,
        JSON.stringify({
          status: "pending",
          mode,
          amount,
          submittedAt: paidAt.toISOString(),
          source: "customer_payment_response",
          sourceUpdateId: String(metadata.sourceUpdateId || ""),
          remarks,
          referenceId,
          transactionId: referenceId,
          note,
          proofMediaUrls,
          confirmationTarget
        }),
        JSON.stringify({
          paymentStatus: "pending",
          paymentType: mode,
          lastCustomerPaymentAt: paidAt.toISOString(),
          lastCustomerPaymentAmount: amount,
          lastCustomerPaymentStatus: "pending",
          lastCustomerPaymentRemarks: remarks,
          paymentProofMediaUrls: proofMediaUrls,
          paymentConfirmationTarget: confirmationTarget
        }),
        mode
      ]
    );
  }
  if (updateType === "payment_response" && input.actor === "assistant") {
    const metadata = input.metadata || {};
    const mode = String(metadata.mode || metadata.paymentMode || "cash").toLowerCase();
    const response = String(metadata.response || "").toLowerCase();
    const status = response === "no" ? "due" : String(metadata.status || "pending").toLowerCase();
    if (mode === "cash" && status === "due") {
      const respondedAt = new Date();
      await pool.query(
        `
          update zigo.service_requests
          set payment_status = case when payment_status = 'paid' then payment_status else 'due' end,
              payment_type = $2,
              payment_details = coalesce(payment_details, '{}'::jsonb) || $3::jsonb,
              metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
              updated_at = now()
          where id = $1
        `,
        [
          input.bookingId,
          mode,
          JSON.stringify({
            status: "due",
            mode,
            amount: Math.max(0, Number(metadata.amount || 0)),
            source: "assistant_cash_not_confirmed",
            sourceUpdateId: String(metadata.sourceUpdateId || ""),
            response: "no",
            respondedAt: respondedAt.toISOString(),
            respondedByUserId: input.userId
          }),
          JSON.stringify({
            paymentStatus: "due",
            paymentType: mode,
            lastAssistantPaymentResponse: "no",
            lastAssistantPaymentResponseAt: respondedAt.toISOString(),
            paymentConfirmationTarget: "",
            chatLocked: false,
            inputLocked: false
          })
        ]
      );
    }
  }
  if (updateType === "payment_received" && input.actor === "assistant") {
    const paidAt = new Date();
    const metadata = input.metadata || {};
    const mode = String(metadata.mode || metadata.paymentMode || "cash").toLowerCase();
    const amount = Math.max(0, Number(metadata.amount || 0));
    const remarks = String(metadata.remarks || metadata.transactionId || "").trim();
    await pool.query(
      `
        update zigo.service_requests
        set payment_type = $2,
            payment_status = 'paid',
            is_paid = true,
            payment_details = coalesce(payment_details, '{}'::jsonb) || $3::jsonb,
            metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        input.bookingId,
        mode,
        JSON.stringify({
          status: "paid",
          mode,
          amount,
          remarks,
          transactionId: String(metadata.transactionId || "").trim(),
          proofMediaUrls: input.mediaUrls || [],
          receivedAt: paidAt.toISOString(),
          receivedByUserId: input.userId,
          source: "assistant_payment_received"
        }),
        JSON.stringify({
          paymentStatus: "paid",
          paymentType: mode,
          isPaid: true,
          chatLocked: true,
          chatLockedAt: paidAt.toISOString(),
          paymentReceivedAt: paidAt.toISOString(),
          paymentReceivedBy: input.userId,
          paymentReceivedMode: mode,
          paymentReceivedRemarks: remarks,
          paymentProofMediaUrls: input.mediaUrls || []
        })
      ]
    );
  }
  if (updateType === "approval_response" && input.actor === "customer") {
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
      categoryId: string | null;
      clusterId: string | null;
      bookingAmountPaise: number | null;
      bookingAvailableAt: string | null;
      requestMetadata: Record<string, unknown> | null;
      bookingMetadata: Record<string, unknown> | null;
    }>(
      `
        select btu.id, btu.service_request_id as "bookingId", btu.task_assignment_id as "assignmentId",
          a.id as "assistantId", cu.user_id as "customerUserId",
          sr.duration_minutes as "durationMinutes", sr.category_id as "categoryId", sr.cluster_id as "clusterId",
          coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0)::bigint as "bookingAmountPaise",
          sr.booking_available_at as "bookingAvailableAt",
          coalesce(btu.metadata, '{}'::jsonb) as "requestMetadata",
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
    if (!row.categoryId) throw new HttpError(409, "Booking category is required to price the extension.");
    const extensionPricing = await client.query<{
      id: string;
      basePrice: string | number;
      discountType: string;
      discountValue: string | number;
      sellingPrice: string | number;
    }>(
      `
        select cpr.id, cpr.base_price as "basePrice", cpr.discount_type as "discountType",
          cpr.discount_value as "discountValue", cpr.selling_price as "sellingPrice"
        from zigo.category_price_rules cpr
        left join zigo.clusters cl on cl.id = $2::uuid
        left join zigo.cities city on city.id = cl.city_id
        where cpr.category_id = $1::uuid
          and cpr.time_duration_minutes = $3::int
          and coalesce(cpr.available_for_extend, false) = true
          and coalesce(cpr.is_enabled, true) = true
          and coalesce(cpr.is_active, true) = true
          and coalesce(cpr.is_deleted, false) = false
          and (
            lower(cpr.scope_type) = 'all'
            or (lower(cpr.scope_type) = 'cluster' and cpr.cluster_id = cl.id)
            or (lower(cpr.scope_type) = 'zone' and cpr.zone_id = cl.zone_id)
            or (lower(cpr.scope_type) = 'city' and cpr.city_id = cl.city_id)
            or (lower(cpr.scope_type) = 'state' and cpr.state_id = city.state_id)
          )
        order by case lower(cpr.scope_type)
          when 'cluster' then 5 when 'zone' then 4 when 'city' then 3 when 'state' then 2 else 1 end desc,
          cpr.updated_at desc
        limit 1
      `,
      [row.categoryId, row.clusterId, requestedMinutes]
    );
    const price = extensionPricing.rows[0];
    if (!price) throw new HttpError(409, `Extension price is not configured for ${requestedMinutes} minutes.`);
    const extensionBasePricePaise = Math.max(0, Math.round(Number(price.basePrice || 0) * 100));
    const extensionAmountPaise = Math.max(0, Math.round(Number(price.sellingPrice || 0) * 100));
    const extensionDiscountPaise = Math.max(0, extensionBasePricePaise - extensionAmountPaise);
    const bookingMetadata = row.bookingMetadata || {};
    const currentExpectedRaw = row.bookingAvailableAt || (typeof bookingMetadata.expectedFreeAt === "string" ? bookingMetadata.expectedFreeAt : "");
    const currentExpected = currentExpectedRaw ? new Date(currentExpectedRaw) : null;
    const baseExpected = currentExpected && !Number.isNaN(currentExpected.getTime())
      ? currentExpected
      : new Date(Date.now() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
    const extendedUntil = new Date(Math.max(baseExpected.getTime(), Date.now()) + requestedMinutes * 60_000);

    const approvedAt = new Date().toISOString();
    const extensionRecord = {
      sourceUpdateId: row.id,
      categoryPriceRuleId: price.id,
      requestedMinutes,
      extensionBasePricePaise,
      extensionDiscountPaise,
      extensionAmountPaise,
      approvedAt,
      extendedUntil: extendedUntil.toISOString()
    };
    await client.query(
      `
        update zigo.booking_task_updates
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
        where id = $1
      `,
      [row.id, JSON.stringify({ status: "approved", approvedBy: userId, ...extensionRecord })]
    );
    const updatedBooking = await client.query<{ bookingEndAt: string | null; bookingAvailableAt: string | null }>(
      `
        update zigo.service_requests
        set duration_minutes = coalesce(duration_minutes, 0) + $2::int,
            booking_amount_paise = coalesce(booking_amount_paise, estimated_amount_paise, 0) + $3::bigint,
            payment_details = case when $3::bigint > 0 then
              coalesce(payment_details, '{}'::jsonb) || jsonb_build_object(
                'paidAmountPaise', greatest(
                  coalesce(nullif(payment_details->>'paidAmountPaise', '')::bigint, 0),
                  case when coalesce(is_paid, false) then coalesce(booking_amount_paise, estimated_amount_paise, 0) else 0 end
                ),
                'extensionBalanceAddedPaise', $3::bigint,
                'extensionBalanceAddedAt', $6::text
              )
              else coalesce(payment_details, '{}'::jsonb) end,
            payment_status = case when $3::bigint > 0 then 'due' else payment_status end,
            is_paid = case when $3::bigint > 0 then false else is_paid end,
            booking_end_at = case when booking_end_at is null then null else booking_end_at + ($2::int * interval '1 minute') end,
            booking_available_at = case when booking_available_at is null then null else booking_available_at + ($2::int * interval '1 minute') end,
            metadata = (coalesce(metadata, '{}'::jsonb) || $4::jsonb)
              || jsonb_build_object(
                'timeExtensions', coalesce(metadata->'timeExtensions', '[]'::jsonb) || $5::jsonb,
                'extensionChargesPaise', coalesce(nullif(metadata->>'extensionChargesPaise', '')::bigint, 0) + $3::bigint
              ),
            updated_at = now()
        where id = $1
        returning booking_end_at as "bookingEndAt", booking_available_at as "bookingAvailableAt"
      `,
      [
        row.bookingId,
        requestedMinutes,
        extensionAmountPaise,
        JSON.stringify({
          expectedFreeAt: extendedUntil.toISOString(),
          lastTimeExtensionMinutes: requestedMinutes,
          lastTimeExtensionApprovedAt: approvedAt,
          lastTimeExtensionAmountPaise: extensionAmountPaise
        }),
        JSON.stringify([extensionRecord]),
        approvedAt
      ]
    );
    const bookingEndAt = updatedBooking.rows[0]?.bookingEndAt || null;
    const bookingAvailableAt = updatedBooking.rows[0]?.bookingAvailableAt || extendedUntil.toISOString();
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
          JSON.stringify({
            expectedFreeAt: bookingAvailableAt,
            taskEndAt: bookingEndAt,
            lastTimeExtensionMinutes: requestedMinutes,
            lastTimeExtensionAmountPaise: extensionAmountPaise
          })
        ]
      );
      await client.query(
        `
          update zigo.assistant_capacity_reservations
          set reserved_until = $2::timestamptz,
              sla_deadline_at = greatest(coalesce(sla_deadline_at, $2::timestamptz), $2::timestamptz),
              updated_at = now(),
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where assignment_id = $1 and status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        `,
        [
          row.assignmentId,
          extendedUntil.toISOString(),
          JSON.stringify({ extendedByCustomer: true, lastTimeExtensionMinutes: requestedMinutes, lastTimeExtensionAmountPaise: extensionAmountPaise })
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
        JSON.stringify(extensionRecord)
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
      extensionAmountPaise,
      bookingEndAt,
      extendedUntil: extendedUntil.toISOString()
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
