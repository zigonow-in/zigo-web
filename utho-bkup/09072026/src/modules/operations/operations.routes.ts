import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requirePermission } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { getAssistantRealtimeSnapshot } from "../assistant-master/assistantMaster.repository.js";
import { getBookingLiveSyncSetting } from "../settings/settings.repository.js";
import { addBookingRealtimeClient, emitBookingRealtimeEvent, ensureBookingRealtimeSchema, getBookingRealtimeStats, listBookingRealtimeEventsAfter, onBookingRealtimeEvent, removeBookingRealtimeClient } from "./bookingRealtime.js";
import {
  assignBooking,
  cancelBookingByAdmin,
  createBookingByAdmin,
  forceCloseBooking,
  getBookingAvailabilityDecision,
  getBookingPriceQuote,
  getLaunchReport,
  listCustomerAddressesForBooking,
  listBookings,
  listLiveOperations,
  reassignBooking,
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
const bookingsQuerySchema = z.object({
  tab: z.enum(["pending_assign", "assigned", "working", "success", "rejected", "cancelled", "hold"]).default("pending_assign"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  datePreset: z.enum(["today", "range", "all"]).default("today"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(120).optional().default("")
});
const realtimeCheckQuerySchema = z.object({
  since: z.string().datetime().optional()
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
      where service_request_id = $1 or request_id = $1
    `,
    [bookingId]
  );
  for (const row of result.rows) {
    await emitAssistantAssignmentRealtimeChange(row.assistantId, bookingId);
  }
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
    await emitBookingRealtimeEvent({
      type: "booking.assigned",
      bookingId: id,
      tab: "assigned",
      message: "Booking assigned",
      payload: { bookingId: id, assignmentId: assignment.id, assistantId: body.assistantId }
    });
    await emitAssistantAssignmentRealtimeChange(body.assistantId, id);
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
    await emitBookingRealtimeEvent({
      type: "booking.reassigned",
      bookingId: id,
      tab: "assigned",
      message: "Booking reassigned",
      payload: { bookingId: id, assignmentId: assignment.id, assistantId: body.assistantId }
    });
    await emitAssistantAssignmentRealtimeChange(body.assistantId, id);
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
    await emitBookingRealtimeEvent({
      type: "booking.cancelled",
      bookingId: id,
      tab: "cancelled",
      message: "Booking cancelled",
      payload: { bookingId: id }
    });
    await emitBookingAssistantsAssignmentRealtimeChange(id);
    res.json({ data: cancelled });
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
    await emitBookingRealtimeEvent({
      type: "booking.closed",
      bookingId: id,
      tab: "success",
      message: "Booking closed",
      payload: { bookingId: id }
    });
    await emitBookingAssistantsAssignmentRealtimeChange(id);
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
