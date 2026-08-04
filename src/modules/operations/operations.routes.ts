import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requirePermission } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { getAssistantRealtimeSnapshot } from "../assistant-master/assistantMaster.repository.js";
import { getBookingLiveSyncSetting } from "../settings/settings.repository.js";
import { addBookingRealtimeClient, emitBookingRealtimeEvent, ensureBookingRealtimeSchema, getBookingRealtimeStats, listBookingRealtimeEventsAfter, onBookingRealtimeEvent, removeBookingRealtimeClient } from "./bookingRealtime.js";
import { pokeBookingOrchestrationWorker } from "./bookingOrchestrator.js";
import { getRazorpayPaymentDetail, listRazorpayPayments, listRazorpayPaymentsForBooking, reconcileRazorpayPayment } from "../payments/payments.repository.js";
import {
  assignAssistantWithCalendarBlock,
  checkDispatchAvailability,
  createTemporaryHold,
  getNextAvailableTime,
  recalculateAssistantAvailability,
  releaseTemporaryHold
} from "./assistantDispatchEngine.js";
import {
  assignBooking,
  addCustomerDisputeMessage,
  cancelBookingByAdmin,
  confirmBookingPaymentByAdmin,
  createBookingByAdmin,
  forceCloseBooking,
  getBookingAvailabilityDecision,
  getBookingReportActivity,
  getBookingPriceQuote,
  getLaunchReport,
  listBookingReviews,
  listCustomerDisputes,
  listCustomerAddressesForBooking,
  listAssignableAssistantsForBooking,
  listBookings,
  listLiveOperations,
  reassignBooking,
  resolveCustomerDispute,
  reverseBookingLocation,
  searchBookingLocations,
  searchCustomersForBooking,
  validateBookingLocation
} from "./operations.repository.js";

export const operationsRouter = Router();
export const reportsRouter = Router();

const bookingParamsSchema = z.object({ id: z.string().uuid() });
const assignmentBodySchema = z.object({
  assistantId: z.string().uuid(),
  reason: z.string().min(3).max(1000),
  forceMultiTaskAssignment: z.coerce.boolean().optional().default(false)
});
const reasonBodySchema = z.object({ reason: z.string().min(3).max(1000) });
const adminPaymentConfirmationBodySchema = z.object({
  response: z.enum(["yes", "no"]),
  referenceId: z.string().trim().max(160).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  proofUrl: z.string().trim().max(1000).optional().default(""),
  sourceUpdateId: z.string().trim().max(120).optional().default("")
});
const bookingsQuerySchema = z.object({
  tab: z.enum(["pending_assign", "assigned", "working", "success", "rejected", "cancelled", "hold"]).default("pending_assign"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  datePreset: z.enum(["today", "range", "all"]).default("today"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(120).optional().default("")
});
const paymentsQuerySchema = z.object({
  status: z.enum(["all", "pending", "processing", "paid", "failed"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().trim().max(120).optional().default("")
});
const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(1000).default(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(200).optional().default("")
});
const paymentParamsSchema = z.object({ id: z.string().uuid() });
const realtimeCheckQuerySchema = z.object({
  since: z.string().datetime().optional()
});
const customerDisputesQuerySchema = z.object({
  status: z.enum(["open", "resolved", "closed", "all"]).default("open"),
  search: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20)
});
const customerDisputeMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(3000)
});
const customerDisputeResolveBodySchema = z.object({
  resolutionType: z.enum(["refund_full", "refund_custom", "no_refund", "cash_full_payment", "cash_custom_payment", "closed"]),
  amountPaise: z.coerce.number().int().min(0).default(0),
  reason: z.string().trim().min(3).max(1000),
  adminResponse: z.string().trim().max(3000).optional().default("")
});
const customerSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });
const locationSearchQuerySchema = z.object({ q: z.string().trim().min(3).max(200) });
const reverseLocationQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
const customerParamsSchema = z.object({ customerId: z.string().uuid() });
const createBookingBodySchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  deliveryTypeId: z.string().uuid().nullable().optional(),
  address: z.string().min(3),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  estimatedAmountPaise: z.coerce.number().int().min(0).default(0),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  metadata: z.record(z.unknown()).default({})
});
const bookingQuoteBodySchema = z.object({
  clusterId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional()
});
const bookingAvailabilityBodySchema = z.object({
  clusterId: z.string().uuid(),
  locationClusterIds: z.array(z.string().uuid()).default([]),
  serviceId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  waitWindowMinutes: z.coerce.number().int().min(0).max(1440).optional().default(0),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional()
});
const dispatchAvailabilityBodySchema = z.object({
  bookingType: z.enum(["instant", "schedule"]),
  clusterId: z.string().uuid(),
  serviceId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  startAt: z.coerce.date().nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional()
});
const dispatchNextAvailableQuerySchema = z.object({
  assistantId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional()
});
const dispatchHoldBodySchema = z.object({
  assistantId: z.string().uuid(),
  clusterId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  sourceType: z.string().trim().max(80).nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({})
});
const dispatchReleaseHoldBodySchema = z.object({
  holdId: z.string().uuid().nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  assistantId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional()
});
const dispatchAssignBodySchema = z.object({
  assistantId: z.string().uuid(),
  bookingId: z.string().uuid(),
  clusterId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  metadata: z.record(z.unknown()).optional().default({})
});
const dispatchRecalculateBodySchema = z.object({
  assistantId: z.string().uuid().nullable().optional(),
  bookingId: z.string().uuid().nullable().optional()
});
const bookingLocationValidationBodySchema = z.object({
  customerId: z.string().uuid(),
  address: z.string().trim().max(2000).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  addressId: z.string().uuid().nullable().optional(),
  source: z.enum(["default", "saved", "whatsapp", "manual", "map", "search", "reverse", "coordinates"]).default("manual")
});
const bookingMasterRoleCodes = new Set(["super_admin", "admin", "manager", "staff"]);

function requireBookingMasterAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.auth?.roles?.some((role) => bookingMasterRoleCodes.has(role))) {
      throw new HttpError(403, "Admin, manager, or staff role required");
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function emitAssistantAssignmentRealtimeChange(assistantId?: string | null, bookingId?: string) {
  if (!assistantId) return;
  const assistant = await getAssistantRealtimeSnapshot(assistantId);
  await emitBookingRealtimeEvent({
    type: "assistant.assignment.changed",
    assistantId,
    bookingId,
    clusterId: assistant?.currentClusterId ?? undefined,
    message: "Assistant availability changed",
    payload: {
      bookingId,
      assistantId,
      assistant
    }
  });
}

async function emitBookingAssistantsAssignmentRealtimeChange(bookingId: string) {
  const result = await pool.query<{ assistantId: string }>(
    `
      select distinct assistant_id as "assistantId"
      from zigo.task_assignments
      where service_request_id = $1::uuid or request_id = $1::uuid
    `,
    [bookingId]
  );
  for (const row of result.rows) {
    await emitAssistantAssignmentRealtimeChange(row.assistantId, bookingId);
  }
}

async function bookingRealtimeAudience(bookingId: string) {
  const result = await pool.query<{
    customerUserId: string | null;
    assistantId: string | null;
    assistantName: string | null;
    assistantPhone: string | null;
    assistantProfilePictureUrl: string | null;
    assistantStatus: string | null;
    clusterId: string | null;
  }>(
    `
      select cu.user_id as "customerUserId",
        ta.assistant_id as "assistantId",
        au.display_name as "assistantName",
        au.phone as "assistantPhone",
        coalesce(profile_doc.preview_url, au.metadata->>'profilePictureUrl') as "assistantProfilePictureUrl",
        lower(coalesce(av.status_code, 'offline')) as "assistantStatus",
        sr.cluster_id as "clusterId"
      from zigo.service_requests sr
      left join zigo.customers cu on cu.id = sr.customer_id
      left join lateral (
        select assistant_id
        from zigo.task_assignments
        where service_request_id = sr.id or request_id = sr.id
        order by assigned_at desc nulls last, offered_at desc nulls last, created_at desc
        limit 1
      ) ta on true
      left join zigo.assistants a on a.id = ta.assistant_id
      left join zigo.users au on au.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join lateral (
        select f.object_key as preview_url
        from zigo.assistant_documents ad
        left join zigo.document_types dt on dt.id = ad.document_type_id
        left join zigo.files f on f.id = ad.file_id
        where ad.assistant_id = a.id and dt.code in ('profile_picture', 'profile_photo')
        order by ad.created_at desc
        limit 1
      ) profile_doc on true
      where sr.id = $1::uuid
      limit 1
    `,
    [bookingId]
  );
  return result.rows[0] || { customerUserId: null, assistantId: null, assistantName: null, assistantPhone: null, assistantProfilePictureUrl: null, assistantStatus: null, clusterId: null };
}

operationsRouter.get("/live", requirePermission("tasks.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listLiveOperations() });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const query = bookingsQuerySchema.parse(req.query);
    const result = await listBookings(query);
    res.json({ data: result.data, pagination: result.pagination, tab: query.tab });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings/:id/report-detail", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const [activity, payments] = await Promise.all([
      getBookingReportActivity(id),
      listRazorpayPaymentsForBooking(id)
    ]);
    res.json({ data: { ...activity, payments } });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/customer-disputes", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const query = customerDisputesQuerySchema.parse(req.query);
    const result = await listCustomerDisputes(query);
    res.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/customer-disputes/:id/messages", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const body = customerDisputeMessageBodySchema.parse(req.body);
    const data = await addCustomerDisputeMessage(id, req.auth!.sub, body.message);
    const audience = await bookingRealtimeAudience(data.bookingId);
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: data.bookingId,
      assistantId: audience.assistantId ?? undefined,
      clusterId: audience.clusterId ?? undefined,
      message: "Admin replied to dispute",
      payload: { bookingId: data.bookingId, disputeId: id, updateId: data.id, customerUserId: audience.customerUserId }
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/customer-disputes/:id/resolve", requirePermission("service_requests.cancel"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const body = customerDisputeResolveBodySchema.parse(req.body);
    const data = await resolveCustomerDispute(id, req.auth!.sub, body);
    const audience = await bookingRealtimeAudience(data.bookingId);
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: data.bookingId,
      assistantId: audience.assistantId ?? undefined,
      clusterId: audience.clusterId ?? undefined,
      message: "Customer dispute resolved",
      payload: { bookingId: data.bookingId, disputeId: id, resolutionType: data.resolutionType, customerUserId: audience.customerUserId }
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings/events", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const settings = await getBookingLiveSyncSetting();
    if (!settings.isEnabled || settings.transport !== "sse") {
      res.status(409).json({ error: { message: "Booking live sync is disabled or not using SSE." } });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    req.socket?.setNoDelay(true);
    req.socket?.setKeepAlive(true);
    req.socket?.setTimeout(0);
    res.socket?.setTimeout(0);
    res.flushHeaders();
    res.write(`retry: ${Math.max(2, Number(settings.reconnectSeconds || 5)) * 1000}\n\n`);
    res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
    addBookingRealtimeClient();
    const lastEventId = req.header("last-event-id") || (typeof req.query.lastEventId === "string" ? req.query.lastEventId : "");
    let cleanedUp = false;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let unsubscribe = () => {};
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (keepAlive) clearInterval(keepAlive);
      unsubscribe();
      removeBookingRealtimeClient();
    };
    unsubscribe = onBookingRealtimeEvent((event) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`id: ${event.id}\n`);
      res.write(`event: booking_changed\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const missedEvents = await listBookingRealtimeEventsAfter(lastEventId, 100);
    for (const event of missedEvents) {
      if (res.writableEnded || res.destroyed) break;
      res.write(`id: ${event.id}\n`);
      res.write(`event: booking_changed\n`);
      res.write(`data: ${JSON.stringify({ ...event, replayed: true })}\n\n`);
    }
    keepAlive = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
    }, 25000);
    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings/realtime/status", requirePermission("service_requests.view"), async (_req, res, next) => {
  try {
    res.json({ data: { settings: await getBookingLiveSyncSetting(), stats: getBookingRealtimeStats() } });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings/realtime/check", requirePermission("service_requests.view"), async (req, res, next) => {
  try {
    const query = realtimeCheckQuerySchema.parse(req.query);
    await ensureBookingRealtimeSchema();
    const since = query.since ? new Date(query.since) : new Date(0);
    const result = await pool.query<{
      changedCount: number;
      latestChangedAt: Date | null;
      serverTime: Date;
    }>(
      `
        select
          count(*)::int as "changedCount",
          max(created_at) as "latestChangedAt",
          now() as "serverTime"
        from zigo.booking_realtime_events
        where created_at > $1
      `,
      [since]
    );
    res.json({
      data: {
        changedCount: result.rows[0]?.changedCount ?? 0,
        latestChangedAt: result.rows[0]?.latestChangedAt ?? null,
        serverTime: result.rows[0]?.serverTime ?? new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/customers/search", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = customerSearchQuerySchema.parse(req.query);
    res.json({ data: await searchCustomersForBooking(query.q) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/locations/search", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = locationSearchQuerySchema.parse(req.query);
    res.json({ data: await searchBookingLocations(query.q) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/locations/reverse", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = reverseLocationQuerySchema.parse(req.query);
    res.json({ data: await reverseBookingLocation(query) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/customers/:customerId/addresses", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const params = customerParamsSchema.parse(req.params);
    res.json({ data: await listCustomerAddressesForBooking(params.customerId) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = createBookingBodySchema.parse(req.body);
    const booking = await createBookingByAdmin({ ...body, actorUserId: req.auth!.sub });
    await emitBookingRealtimeEvent({
      type: "booking.created",
      bookingId: booking.id,
      tab: "pending_assign",
      message: "New booking created",
      payload: { bookingId: booking.id }
    });
    await emitBookingAssistantsAssignmentRealtimeChange(booking.id);
    pokeBookingOrchestrationWorker("admin_booking_created");
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/quote", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = bookingQuoteBodySchema.parse(req.body);
    res.json({ data: await getBookingPriceQuote(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/availability", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = bookingAvailabilityBodySchema.parse(req.body);
    res.json({ data: await getBookingAvailabilityDecision(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/dispatch/availability", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = dispatchAvailabilityBodySchema.parse(req.body);
    res.json({
      data: await checkDispatchAvailability({
        bookingType: body.bookingType,
        clusterId: body.clusterId,
        serviceId: body.serviceId,
        categoryId: body.categoryId,
        durationMinutes: body.durationMinutes,
        startAt: body.startAt,
        destination: body.latitude != null && body.longitude != null ? { latitude: body.latitude, longitude: body.longitude } : null
      })
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/dispatch/next-available", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = dispatchNextAvailableQuerySchema.parse(req.query);
    res.json({ data: await getNextAvailableTime(query) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/dispatch/holds", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = dispatchHoldBodySchema.parse(req.body);
    res.status(201).json({ data: await createTemporaryHold(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/dispatch/holds/release", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = dispatchReleaseHoldBodySchema.parse(req.body);
    res.json({ data: await releaseTemporaryHold(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/dispatch/assignments", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = dispatchAssignBodySchema.parse(req.body);
    res.status(201).json({ data: await assignAssistantWithCalendarBlock(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/dispatch/recalculate", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = dispatchRecalculateBodySchema.parse(req.body);
    res.json({ data: await recalculateAssistantAvailability(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/bookings/:id/assignable-assistants", requirePermission("tasks.assign"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    res.json({ data: await listAssignableAssistantsForBooking(id) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/location/validate", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const body = bookingLocationValidationBodySchema.parse(req.body);
    res.json({ data: await validateBookingLocation(body) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/:id/assign", requirePermission("tasks.assign"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const body = assignmentBodySchema.parse(req.body);
    const assignment = await assignBooking({
      serviceRequestId: id,
      assistantId: body.assistantId,
      reason: body.reason,
      forceMultiTaskAssignment: body.forceMultiTaskAssignment,
      actorUserId: req.auth!.sub
    });
    try {
      const audience = await bookingRealtimeAudience(id);
      await emitBookingRealtimeEvent({
        type: "booking.assigned",
        bookingId: id,
        assistantId: body.assistantId,
        clusterId: audience.clusterId ?? undefined,
        tab: "assigned",
        message: "Booking assigned",
        payload: {
          bookingId: id,
          assignmentId: assignment.id,
          assistantId: body.assistantId,
          customerUserId: audience.customerUserId,
          assistant: {
            id: body.assistantId,
            name: audience.assistantName,
            displayName: audience.assistantName,
            phone: audience.assistantPhone,
            profilePictureUrl: audience.assistantProfilePictureUrl,
            status: audience.assistantStatus
          }
        }
      });
      await emitAssistantAssignmentRealtimeChange(body.assistantId, id);
    } catch (emitError) {
      console.error("Booking assignment realtime emit failed", emitError);
    }
    pokeBookingOrchestrationWorker("admin_booking_assigned");
    res.status(201).json({
      data: assignment
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/:id/reassign", requirePermission("tasks.switch"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const body = assignmentBodySchema.parse(req.body);
    const assignment = await reassignBooking({
      serviceRequestId: id,
      assistantId: body.assistantId,
      reason: body.reason,
      forceMultiTaskAssignment: body.forceMultiTaskAssignment,
      actorUserId: req.auth!.sub
    });
    try {
      const audience = await bookingRealtimeAudience(id);
      await emitBookingRealtimeEvent({
        type: "booking.reassigned",
        bookingId: id,
        assistantId: body.assistantId,
        clusterId: audience.clusterId ?? undefined,
        tab: "assigned",
        message: "Booking reassigned",
        payload: {
          bookingId: id,
          assignmentId: assignment.id,
          assistantId: body.assistantId,
          customerUserId: audience.customerUserId,
          assistant: {
            id: body.assistantId,
            name: audience.assistantName,
            displayName: audience.assistantName,
            phone: audience.assistantPhone,
            profilePictureUrl: audience.assistantProfilePictureUrl,
            status: audience.assistantStatus
          }
        }
      });
      await emitAssistantAssignmentRealtimeChange(body.assistantId, id);
    } catch (emitError) {
      console.error("Booking reassignment realtime emit failed", emitError);
    }
    pokeBookingOrchestrationWorker("admin_booking_reassigned");
    res.status(201).json({
      data: assignment
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/:id/cancel", requirePermission("service_requests.cancel"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const { reason } = reasonBodySchema.parse(req.body);
    const cancelled = await cancelBookingByAdmin(id, req.auth!.sub, reason);
    if (!cancelled) throw new HttpError(404, "Cancellable booking not found");
    try {
      const audience = await bookingRealtimeAudience(id);
      await emitBookingRealtimeEvent({
        type: "booking.cancelled",
        bookingId: id,
        assistantId: audience.assistantId ?? undefined,
        clusterId: audience.clusterId ?? undefined,
        tab: "cancelled",
        message: "Booking cancelled",
        payload: { bookingId: id, customerUserId: audience.customerUserId }
      });
      await emitBookingAssistantsAssignmentRealtimeChange(id);
    } catch (emitError) {
      console.error("Booking cancellation emit failed", emitError);
    }
    pokeBookingOrchestrationWorker("admin_booking_cancelled");
    res.json({ data: cancelled });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/:id/payment-confirmation", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const body = adminPaymentConfirmationBodySchema.parse(req.body);
    const data = await confirmBookingPaymentByAdmin(id, req.auth!.sub, body);
    try {
      const audience = await bookingRealtimeAudience(id);
      await emitBookingRealtimeEvent({
        type: "booking.updated",
        bookingId: id,
        assistantId: audience.assistantId ?? undefined,
        clusterId: audience.clusterId ?? undefined,
        message: body.response === "yes" ? "Payment marked as paid" : "Payment confirmation kept pending",
        payload: {
          bookingId: id,
          customerUserId: audience.customerUserId,
          paymentStatus: data.paymentStatus,
          paymentType: data.paymentType,
          isPaid: data.isPaid
        }
      });
      if (audience.assistantId) await emitAssistantAssignmentRealtimeChange(audience.assistantId, id);
    } catch (emitError) {
      console.error("Booking payment confirmation emit failed", emitError);
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/payments", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = paymentsQuerySchema.parse(req.query);
    res.json({ data: await listRazorpayPayments(query) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/reviews", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const query = reviewsQuerySchema.parse(req.query);
    res.json({ data: await listBookingReviews(query) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/payments/:id", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const { id } = paymentParamsSchema.parse(req.params);
    res.json({ data: await getRazorpayPaymentDetail(id) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/payments/:id/reconcile", requireBookingMasterAccess, async (req, res, next) => {
  try {
    const { id } = paymentParamsSchema.parse(req.params);
    res.json({ data: await reconcileRazorpayPayment(id) });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/bookings/:id/force-close", requirePermission("tasks.close"), async (req, res, next) => {
  try {
    const { id } = bookingParamsSchema.parse(req.params);
    const { reason } = reasonBodySchema.parse(req.body);
    const closed = await forceCloseBooking(id, req.auth!.sub, reason);
    if (!closed) throw new HttpError(404, "Closable booking not found");
    try {
      const audience = await bookingRealtimeAudience(id);
      await emitBookingRealtimeEvent({
        type: "booking.closed",
        bookingId: id,
        assistantId: audience.assistantId ?? undefined,
        clusterId: audience.clusterId ?? undefined,
        tab: "success",
        message: "Booking closed",
        payload: { bookingId: id, customerUserId: audience.customerUserId }
      });
      await emitBookingAssistantsAssignmentRealtimeChange(id);
    } catch (emitError) {
      console.error("Booking force-close emit failed", emitError);
    }
    pokeBookingOrchestrationWorker("admin_booking_force_closed");
    res.json({ data: closed });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/launch", requirePermission("admin.dashboard.view"), async (_req, res, next) => {
  try {
    res.json({ data: await getLaunchReport() });
  } catch (error) {
    next(error);
  }
});
