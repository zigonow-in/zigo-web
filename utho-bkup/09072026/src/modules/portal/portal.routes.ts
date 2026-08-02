import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors.js";
import {
  addBookingRealtimeClient,
  emitBookingRealtimeEvent,
  getBookingRealtimeStats,
  listBookingRealtimeEventsAfter,
  onBookingRealtimeEvent,
  removeBookingRealtimeClient,
  type BookingRealtimeEvent
} from "../operations/bookingRealtime.js";
import {
  addCustomerPortalCartItem,
  approvePortalTimeExtension,
  cancelCustomerPortalBooking,
  createCustomerPortalBooking,
  createPortalTaskUpdate,
  deleteCustomerPortalCartItem,
  getCustomerPortalBookingAvailability,
  getCustomerPortalCatalog,
  getCustomerPortalCart,
  getPortalConfig,
  getPortalMe,
  listPortalBookingQuickReplies,
  listCustomerPortalAddresses,
  listAssistantPortalTasks,
  listCustomerPortalBookings,
  loginAssistantPortalWithPassword,
  markPortalBookingTaskUpdatesRead,
  requestPortalCode,
  reverseCustomerPortalLocation,
  saveCustomerPortalAddress,
  saveCustomerPortalCart,
  searchCustomerPortalLocations,
  sendAssistantPasswordResetCode,
  setAssistantPortalOnline,
  saveCustomerPortalFavorites,
  updateAssistantPortalTaskStatus,
  validateCustomerPortalLocation,
  verifyAssistantPasswordResetCode,
  verifyPortalCode,
  verifyPortalToken
} from "./portal.repository.js";
import { saveDocumentUpload } from "../settings/settings.repository.js";

export const portalRouter = Router();

const actorParamsSchema = z.object({ actor: z.enum(["customer", "assistant"]) });
const codeRequestBodySchema = z.object({
  phone: z.string().trim().min(6).max(30),
  displayName: z.string().trim().max(150).nullable().optional()
});
const codeVerifyBodySchema = z.object({
  phone: z.string().trim().min(6).max(30),
  code: z.string().regex(/^\d{6}$/, "Enter 6 digit verification code.")
});
const assistantPasswordLoginBodySchema = z.object({
  identifier: z.string().trim().min(3).max(180),
  password: z.string().min(1).max(200)
});
const assistantPasswordResetSendBodySchema = z.object({
  identifier: z.string().trim().min(3).max(180).optional(),
  email: z.string().trim().email().max(320)
});
const assistantPasswordResetVerifyBodySchema = z.object({
  identifier: z.string().trim().min(3).max(180).optional(),
  email: z.string().trim().email().max(320),
  code: z.string().regex(/^\d{6}$/, "Enter 6 digit verification code."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200)
});
const locationSearchQuerySchema = z.object({ q: z.string().trim().min(3).max(200) });
const reverseLocationQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
const customerCatalogQuerySchema = z.object({
  clusterId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional()
});
const customerBookingsQuerySchema = z.object({
  tab: z.enum(["all", "working", "assigned", "upcoming", "completed", "cancelled"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});
const customerLocationValidationBodySchema = z.object({
  address: z.string().trim().min(3).max(2000).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  addressId: z.string().uuid().nullable().optional(),
  source: z.enum(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).default("manual")
});
const customerAddressBodySchema = z.object({
  label: z.string().trim().min(2).max(80).default("Home"),
  customLabel: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().min(3).max(2000),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  landmark: z.string().trim().max(1000).nullable().optional(),
  personName: z.string().trim().max(150).nullable().optional(),
  contactNumber: z.string().trim().max(30).nullable().optional(),
  source: z.enum(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).default("manual"),
  isDefault: z.coerce.boolean().default(false)
});
const bookingBodySchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  deliveryTypeId: z.string().uuid().nullable().optional(),
  address: z.string().trim().min(3),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  estimatedAmountPaise: z.coerce.number().int().min(0).default(0),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  metadata: z.record(z.unknown()).default({})
});
const customerBookingAvailabilityBodySchema = z.object({
  clusterId: z.string().uuid(),
  locationClusterIds: z.array(z.string().uuid()).default([]),
  serviceId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  waitWindowMinutes: z.coerce.number().int().min(0).max(1440).optional().default(0),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional()
});
const customerCartBodySchema = z.object({
  cartItems: z.array(z.record(z.unknown())).default([]),
  customerNote: z.string().trim().max(4000).default("")
});
const customerCartItemBodySchema = z.object({
  item: z.object({}).passthrough(),
  customerNote: z.string().trim().max(4000).optional(),
  replaceCart: z.coerce.boolean().default(false)
});
const customerCartDeleteItemBodySchema = z.object({
  id: z.string().trim().min(1).max(200).nullable().optional(),
  categoryId: z.string().trim().min(1).max(200).nullable().optional(),
  storeId: z.string().trim().min(1).max(200).nullable().optional(),
  index: z.coerce.number().int().min(0).nullable().optional()
}).refine((value) => Boolean(value.id || value.categoryId || value.storeId || value.index != null), {
  message: "Cart item identifier is required."
});
const customerFavoritesBodySchema = z.object({
  services: z.array(z.string().trim().min(1).max(200)).default([]),
  categories: z.array(z.string().trim().min(1).max(200)).default([]),
  stores: z.array(z.string().trim().min(1).max(200)).default([])
});
const cancelBookingBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).default("Cancelled by customer")
});
const onlineBodySchema = z.object({ isOnline: z.boolean() });
const taskStatusBodySchema = z.object({ status: z.enum(["accepted", "in_progress", "completed", "rejected"]) });
const taskUpdateBodySchema = z.object({
  bookingId: z.string().uuid(),
  assignmentId: z.string().uuid().nullable().optional(),
  updateType: z.enum([
    "text",
    "image",
    "voice",
    "video",
    "file",
    "location",
    "status",
    "payment_request",
    "payment_response",
    "approval_request",
    "approval_response",
    "time_extension_request",
    "time_extension_approved"
  ]).default("text"),
  message: z.string().trim().max(2000).nullable().optional(),
  mediaUrls: z.array(z.string().trim().min(1).max(1000)).default([]),
  metadata: z.record(z.unknown()).default({})
});
const taskMediaBodySchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(160),
  dataBase64: z.string().min(1)
});
const taskUpdateReadBodySchema = z.object({
  bookingId: z.string().uuid()
});

declare global {
  namespace Express {
    interface Request {
      portalAuth?: { userId: string; actor: "customer" | "assistant" };
    }
  }
}

function requirePortalAuth(actor?: "customer" | "assistant") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authorization = req.header("authorization");
      const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
      if (!token) throw new HttpError(401, "Portal authorization token required.");
      req.portalAuth = verifyPortalToken(token, actor);
      next();
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(401, "Invalid portal authorization token."));
    }
  };
}

function portalRealtimeToken(req: Request) {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const queryToken = req.query.access_token;
  return typeof queryToken === "string" ? queryToken : "";
}

function bookingRealtimeEventBelongsToAssistant(event: BookingRealtimeEvent, assistantId: string) {
  const payload = event.payload || {};
  return event.assistantId === assistantId
    || payload.assistantId === assistantId
    || (payload.assistant && typeof payload.assistant === "object" && (payload.assistant as { id?: unknown }).id === assistantId);
}

function bookingRealtimeEventBelongsToCustomer(event: BookingRealtimeEvent, customerUserId: string) {
  const payload = event.payload || {};
  return payload.customerUserId === customerUserId
    || (payload.customer && typeof payload.customer === "object" && (payload.customer as { userId?: unknown }).userId === customerUserId);
}

portalRouter.get("/config", async (_req, res, next) => {
  try {
    res.json({ data: await getPortalConfig() });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/assistant/events", async (req, res, next) => {
  try {
    const auth = verifyPortalToken(portalRealtimeToken(req), "assistant");
    const me = await getPortalMe({ userId: auth.userId, actor: "assistant" });
    if (!me.assistantId) throw new HttpError(404, "Assistant profile not found.");

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
    res.write("retry: 5000\n\n");
    res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
    addBookingRealtimeClient();
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

    const sendEvent = (event: BookingRealtimeEvent, replayed = false) => {
      if (!bookingRealtimeEventBelongsToAssistant(event, me.assistantId!)) return;
      if (res.writableEnded || res.destroyed) return;
      res.write(`id: ${event.id}\n`);
      res.write("event: assistant_task_changed\n");
      res.write(`data: ${JSON.stringify({ ...event, replayed })}\n\n`);
    };

    unsubscribe = onBookingRealtimeEvent((event) => sendEvent(event));
    const lastEventId = req.header("last-event-id") || (typeof req.query.lastEventId === "string" ? req.query.lastEventId : "");
    const missedEvents = await listBookingRealtimeEventsAfter(lastEventId, 100);
    for (const event of missedEvents) sendEvent(event, true);

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

portalRouter.get("/customer/events", async (req, res, next) => {
  try {
    const auth = verifyPortalToken(portalRealtimeToken(req), "customer");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    req.socket?.setNoDelay(true);
    req.socket?.setKeepAlive(true);
    res.flushHeaders();
    res.write("retry: 5000\n\n");
    res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
    addBookingRealtimeClient();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(keepAlive);
      unsubscribe();
      removeBookingRealtimeClient();
    };

    const sendEvent = (event: BookingRealtimeEvent, replayed = false) => {
      if (!bookingRealtimeEventBelongsToCustomer(event, auth.userId)) return;
      if (res.writableEnded || res.destroyed) return;
      res.write(`id: ${event.id}\n`);
      res.write("event: customer_booking_changed\n");
      res.write(`data: ${JSON.stringify({ ...event, replayed })}\n\n`);
    };

    const unsubscribe = onBookingRealtimeEvent((event) => sendEvent(event));
    const lastEventId = req.header("last-event-id") || (typeof req.query.lastEventId === "string" ? req.query.lastEventId : "");
    const missedEvents = await listBookingRealtimeEventsAfter(lastEventId, 100);
    for (const event of missedEvents) sendEvent(event, true);

    const keepAlive = setInterval(() => {
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

portalRouter.post("/:actor/code/send", async (req, res, next) => {
  try {
    const params = actorParamsSchema.parse(req.params);
    const body = codeRequestBodySchema.parse(req.body);
    res.status(201).json({ data: await requestPortalCode({ actor: params.actor, ...body }) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/:actor/code/verify", async (req, res, next) => {
  try {
    const params = actorParamsSchema.parse(req.params);
    const body = codeVerifyBodySchema.parse(req.body);
    res.json({ data: await verifyPortalCode({ actor: params.actor, ...body }) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/assistant/password/login", async (req, res, next) => {
  try {
    const body = assistantPasswordLoginBodySchema.parse(req.body);
    res.json({ data: await loginAssistantPortalWithPassword(body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/assistant/password-reset/send", async (req, res, next) => {
  try {
    const body = assistantPasswordResetSendBodySchema.parse(req.body);
    res.status(201).json({ data: await sendAssistantPasswordResetCode(body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/assistant/password-reset/verify", async (req, res, next) => {
  try {
    const body = assistantPasswordResetVerifyBodySchema.parse(req.body);
    res.json({ data: await verifyAssistantPasswordResetCode(body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/me", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    res.json({ data: await getPortalMe({ userId: req.portalAuth!.userId, actor: "customer" }) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/assistant/me", requirePortalAuth("assistant"), async (req, res, next) => {
  try {
    res.json({ data: await getPortalMe({ userId: req.portalAuth!.userId, actor: "assistant" }) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/bookings", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const query = customerBookingsQuerySchema.parse(req.query);
    const result = await listCustomerPortalBookings(req.portalAuth!.userId, query);
    res.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    res.json({ data: await getCustomerPortalCart(req.portalAuth!.userId) });
  } catch (error) {
    next(error);
  }
});

portalRouter.put("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerCartBodySchema.parse(req.body);
    res.json({ data: await saveCustomerPortalCart(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/cart/items", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerCartItemBodySchema.parse(req.body);
    res.json({ data: await addCustomerPortalCartItem(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.delete("/customer/cart/items", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerCartDeleteItemBodySchema.parse(req.body);
    res.json({ data: await deleteCustomerPortalCartItem(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.delete("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    res.json({ data: await saveCustomerPortalCart(req.portalAuth!.userId, { cartItems: [], customerNote: "" }) });
  } catch (error) {
    next(error);
  }
});

portalRouter.put("/customer/favorites", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerFavoritesBodySchema.parse(req.body);
    res.json({ data: await saveCustomerPortalFavorites(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/catalog", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const query = customerCatalogQuerySchema.parse(req.query);
    res.json({ data: await getCustomerPortalCatalog(query) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/locations/search", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const query = locationSearchQuerySchema.parse(req.query);
    res.json({ data: await searchCustomerPortalLocations(query.q) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/locations/reverse", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const query = reverseLocationQuerySchema.parse(req.query);
    res.json({ data: await reverseCustomerPortalLocation(query) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/locations/validate", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerLocationValidationBodySchema.parse(req.body);
    res.json({ data: await validateCustomerPortalLocation(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/customer/addresses", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    res.json({ data: await listCustomerPortalAddresses(req.portalAuth!.userId) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/addresses", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerAddressBodySchema.parse(req.body);
    res.status(201).json({ data: await saveCustomerPortalAddress(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/bookings", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const booking = await createCustomerPortalBooking(req.portalAuth!.userId, bookingBodySchema.parse(req.body));
    await emitBookingRealtimeEvent({
      type: "booking.created",
      bookingId: booking.id,
      tab: "pending_assign",
      message: "New customer portal booking created",
      payload: { bookingId: booking.id, source: "customer_portal", customerUserId: req.portalAuth!.userId }
    });
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/bookings/availability", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const body = customerBookingAvailabilityBodySchema.parse(req.body);
    res.json({ data: await getCustomerPortalBookingAvailability(req.portalAuth!.userId, body) });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/bookings/:bookingId/quick-replies", requirePortalAuth(), async (req, res, next) => {
  try {
    const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
    res.json(await listPortalBookingQuickReplies(req.portalAuth!.userId, req.portalAuth!.actor, params.bookingId));
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/customer/bookings/:bookingId/cancel", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
    const body = cancelBookingBodySchema.parse(req.body);
    const data = await cancelCustomerPortalBooking(req.portalAuth!.userId, { bookingId: params.bookingId, reason: body.reason });
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: data.bookingId,
      assistantId: data.assistantId ?? undefined,
      tab: "cancelled",
      message: "Customer cancelled booking",
      payload: {
        bookingId: data.bookingId,
        customerUserId: req.portalAuth!.userId,
        assistantId: data.assistantId,
        reason: body.reason,
        source: "customer_portal"
      }
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/assistant/tasks", requirePortalAuth("assistant"), async (req, res, next) => {
  try {
    res.json({ data: await listAssistantPortalTasks(req.portalAuth!.userId) });
  } catch (error) {
    next(error);
  }
});

portalRouter.patch("/assistant/availability", requirePortalAuth("assistant"), async (req, res, next) => {
  try {
    const body = onlineBodySchema.parse(req.body);
    const data = await setAssistantPortalOnline(req.portalAuth!.userId, body.isOnline);
    await emitBookingRealtimeEvent({
      type: "assistant.availability.changed",
      assistantId: data.assistantId,
      message: body.isOnline ? "Assistant is online" : "Assistant is offline",
      payload: { assistantId: data.assistantId, isOnline: body.isOnline }
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.patch("/assistant/tasks/:assignmentId/status", requirePortalAuth("assistant"), async (req, res, next) => {
  try {
    const params = z.object({ assignmentId: z.string().uuid() }).parse(req.params);
    const body = taskStatusBodySchema.parse(req.body);
    const data = await updateAssistantPortalTaskStatus(req.portalAuth!.userId, { assignmentId: params.assignmentId, status: body.status });
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: data.bookingId,
      assistantId: data.assistantId,
      message: `Assistant task ${body.status.replace("_", " ")}`,
      payload: data
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/task-updates", requirePortalAuth(), async (req, res, next) => {
  try {
    const body = taskUpdateBodySchema.parse(req.body);
    const data = await createPortalTaskUpdate({
      userId: req.portalAuth!.userId,
      actor: req.portalAuth!.actor,
      ...body
    });
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: body.bookingId,
      assistantId: data.assistantId ?? undefined,
      message: "Booking timeline updated",
      payload: {
        bookingId: body.bookingId,
        updateId: data.id,
        actor: req.portalAuth!.actor,
        assistantId: data.assistantId,
        customerUserId: data.customerUserId
      }
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/task-updates/read", requirePortalAuth(), async (req, res, next) => {
  try {
    const body = taskUpdateReadBodySchema.parse(req.body);
    const data = await markPortalBookingTaskUpdatesRead(req.portalAuth!.userId, req.portalAuth!.actor, body.bookingId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/task-media", requirePortalAuth(), async (req, res, next) => {
  try {
    const body = taskMediaBodySchema.parse(req.body);
    const data = await saveDocumentUpload({
      originalName: body.originalName,
      mimeType: body.mimeType,
      dataBase64: body.dataBase64,
      actorUserId: req.portalAuth!.userId
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/task-updates/:updateId/approve-time", requirePortalAuth("customer"), async (req, res, next) => {
  try {
    const params = z.object({ updateId: z.string().uuid() }).parse(req.params);
    const data = await approvePortalTimeExtension(req.portalAuth!.userId, params.updateId);
    await emitBookingRealtimeEvent({
      type: "booking.updated",
      bookingId: data.bookingId,
      assistantId: data.assistantId ?? undefined,
      message: "Task time extended",
      payload: {
        bookingId: data.bookingId,
        updateId: data.id,
        assistantId: data.assistantId,
        customerUserId: data.customerUserId,
        requestedMinutes: data.requestedMinutes,
        extendedUntil: data.extendedUntil
      }
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});
