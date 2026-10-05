import { Router } from "express";
import { locationClustersCanInterserve } from "../masters/locationHierarchy.repository.js";
import { z } from "zod";
import { HttpError } from "../../http/errors.js";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { addBookingRealtimeClient, emitBookingRealtimeEvent, getBookingRealtimeStats, onBookingRealtimeEvent, removeBookingRealtimeClient } from "../operations/bookingRealtime.js";
import { runBookingOrchestrationCycle } from "../operations/bookingEngine.js";
import { enqueueTrackingOutboxEvent } from "../operations/trackingOutbox.js";
import { pokeBookingOrchestrationWorker } from "../operations/bookingOrchestrator.js";
import { getBookingEngineSetting } from "../settings/settings.repository.js";
import { addCustomerPortalCartItem, assertActivePortalSession, approvePortalTimeExtension, cancelCustomerPortalBooking, createCustomerPortalBooking, createCustomerPortalBookingAddOnOrder, createCustomerPortalCashExtension, createCustomerPortalTipOrder, completeCustomerPortalBookingAddOn, createCustomerPortalDispute, createPortalTaskUpdate, deleteCustomerPortalCartItem, deleteCustomerPortalAddress, getCustomerPortalBookingAvailability, getCustomerPortalDefaultLocation, getCustomerPortalBooking, getCustomerPortalCatalog, getCustomerPortalWallet, getCustomerPortalWalletTransaction, getCustomerPortalCart, getPortalConfig, getPortalMe, listPortalBookingQuickReplies, listCustomerPortalAddresses, listCustomerPortalPreviousUsedLocations, listCustomerPortalServiceBoundaries, recordAssistantPortalLocationPing, recordCustomerPortalUnserviceableLocation, refreshPortalSession, listAssistantPortalTasks, listCustomerPortalAssistants, listCustomerPortalBookings, listCustomerPortalWalletTransactions, loginAssistantPortalWithPassword, markPortalBookingTaskUpdatesRead, requestPortalCode, reverseCustomerPortalLocation, saveCustomerPortalAddress, saveCustomerPortalDefaultLocation, saveCustomerPortalPreviousUsedLocation, setCustomerPortalDefaultAddress, saveCustomerPortalCart, searchCustomerPortalLocations, sendAssistantPasswordResetCode, setAssistantPortalOnline, saveCustomerPortalBookingReview, saveCustomerPortalFavorites, updateAssistantPortalTaskStatus, updateCustomerPortalProfile, updateCustomerPortalBookingTip, updateCustomerPortalAddress, validateCustomerPortalLocation, verifyAssistantPasswordResetCode, verifyPortalCode, verifyPortalToken } from "./portal.repository.js";
import { pokeBookingInvoiceEmailWorker } from "./bookingInvoice.worker.js";
import { saveDocumentUpload } from "../settings/settings.repository.js";
import { createRazorpayPaymentOrder, getCustomerRazorpayOrderStatus, verifyAndSaveRazorpayPayment } from "../payments/payments.repository.js";
import { addCustomerSupportMessage, createCustomerSupportTicket, getCustomerSupportTicket, listCustomerSupportTickets } from "../support/support.repository.js";
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
const locationSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(200) });
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
const customerSupportListSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(50).default(20),
    bookingId: z.string().uuid().optional()
});
const customerSupportTicketSchema = z.object({
    subject: z.string().trim().min(3).max(200),
    category: z.enum(["general", "booking", "payment", "assistant", "location", "account"]).default("general"),
    message: z.string().trim().max(4000).default(""),
    bookingId: z.string().uuid().nullable().optional()
});
const customerSupportAttachmentSchema = z.object({
    url: z.string().trim().min(1).max(1000),
    name: z.string().trim().max(255).optional(),
    type: z.string().trim().max(160).optional(),
    size: z.coerce.number().int().min(0).max(25 * 1024 * 1024).optional()
});
const customerSupportMessageSchema = z.object({
    message: z.string().trim().max(4000).default(""),
    attachments: z.array(customerSupportAttachmentSchema).max(8).default([])
}).refine((value) => Boolean(value.message || value.attachments.length), "Enter a message or attach a file.");
const customerSupportParamsSchema = z.object({ ticketId: z.string().uuid() });
const customerProfileBodySchema = z.object({
    displayName: z.string().trim().min(2, "Enter your name.").max(150),
    email: z.union([z.string().trim().email("Enter a valid email address.").max(320), z.null()]).optional(),
    gender: z.enum(["male", "female", "other"]).nullable().optional()
});
const customerLocationValidationBodySchema = z.object({
    address: z.string().trim().min(3).max(2000).nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    addressId: z.string().uuid().nullable().optional(),
    source: z.enum(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).default("manual")
});
const customerPreviousUsedLocationBodySchema = customerLocationValidationBodySchema.extend({
    address: z.string().trim().min(3).max(2000),
    stateName: z.string().trim().max(150).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional()
});
const customerUnserviceableLocationBodySchema = customerLocationValidationBodySchema.extend({
    title: z.string().trim().max(200).nullable().optional(),
    address: z.string().trim().min(3).max(2000),
    stateName: z.string().trim().max(150).nullable().optional(),
    cityName: z.string().trim().max(150).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    metadata: z.record(z.unknown()).optional().default({})
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
    stateName: z.string().trim().max(150).nullable().optional(),
    cityName: z.string().trim().max(150).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    source: z.enum(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).default("manual"),
    isDefault: z.coerce.boolean().default(false)
});
const customerAddressParamsSchema = z.object({ addressId: z.string().uuid() });
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
const razorpayOrderBodySchema = z.object({
    amountPaise: z.coerce.number().int().min(100),
    currency: z.string().trim().length(3).default("INR"),
    bookingId: z.string().uuid().optional(),
    receipt: z.string().trim().max(40).optional(),
    bookingReference: z.string().trim().max(40).optional(),
    bookingType: z.enum(["instant", "schedule"]).optional(),
    serviceCode: z.string().trim().max(80).optional().nullable(),
    serviceName: z.string().trim().max(160).optional().nullable(),
    categoryCode: z.string().trim().max(80).optional().nullable(),
    categoryName: z.string().trim().max(160).optional().nullable()
});
const razorpayVerifyBodySchema = z.object({
    razorpay_order_id: z.string().trim().min(1),
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().min(1)
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
const customerBookingTipBodySchema = z.object({
    amountPaise: z.coerce.number().int().min(0).max(100000)
}).refine((value) => value.amountPaise === 0 || value.amountPaise >= 2000, {
    message: "Tip must be zero or at least ₹20."
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
const customerBookingReviewBodySchema = z.object({
    zigoRating: z.coerce.number().int().min(1).max(5),
    assistantRating: z.coerce.number().int().min(1).max(5),
    serviceRating: z.coerce.number().int().min(1).max(5),
    reviewText: z.string().trim().max(2000).default("")
});
const customerDisputeBodySchema = z.object({
    bookingId: z.string().uuid(),
    subject: z.string().trim().min(3).max(200).default("Booking dispute"),
    description: z.string().trim().min(3).max(3000),
    requestRefund: z.coerce.boolean().default(false),
    requestedRefundAmountPaise: z.coerce.number().int().min(0).default(0)
});
const assistantLocationBodySchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).nullable().optional(),
    capturedAt: z.string().datetime().nullable().optional()
});
const onlineBodySchema = z.object({
    isOnline: z.boolean(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    accuracy: z.coerce.number().min(0).nullable().optional(),
    capturedAt: z.string().datetime().nullable().optional()
});
const taskStatusBodySchema = z.object({
    status: z.enum(["accepted", "in_progress", "completed", "rejected"]),
    pin: z.string().trim().regex(/^\d{4}$/, "PIN must be 4 digits").optional()
});
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
        "payment_received",
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
    dataBase64: z.string().min(1),
    context: z.enum(["booking"]).optional()
});
const taskUpdateReadBodySchema = z.object({
    bookingId: z.string().uuid()
});
function requirePortalAuth(actor) {
    return async (req, _res, next) => {
        try {
            const authorization = req.header("authorization") || req.header("x-portal-authorization");
            const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
            if (!token)
                throw new HttpError(401, "Portal authorization token required.");
            req.portalAuth = verifyPortalToken(token, actor);
            await assertActivePortalSession(req.portalAuth.userId, req.portalAuth.actor);
            next();
        }
        catch (error) {
            next(error instanceof HttpError ? error : new HttpError(401, "Invalid portal authorization token."));
        }
    };
}
portalRouter.get('/:actor/session', requirePortalAuth(), (req, res, next) => {
    if (req.params.actor !== req.portalAuth.actor)
        return next(new HttpError(401, 'Portal session mismatch.'));
    res.status(204).send();
});
function portalRealtimeToken(req) {
    const authorization = req.header("authorization");
    if (authorization?.startsWith("Bearer "))
        return authorization.slice(7);
    const queryToken = req.query.access_token;
    return typeof queryToken === "string" ? queryToken : "";
}
function bookingRealtimeEventBelongsToAssistant(event, assistantId) {
    const payload = event.payload || {};
    return event.assistantId === assistantId
        || payload.assistantId === assistantId
        || (payload.assistant && typeof payload.assistant === "object" && payload.assistant.id === assistantId);
}
function bookingRealtimeEventBelongsToCustomer(event, customerUserId) {
    const payload = event.payload || {};
    return payload.customerUserId === customerUserId
        || (payload.customer && typeof payload.customer === "object" && payload.customer.userId === customerUserId);
}
async function bookingRealtimeEventBelongsToCustomerAsync(event, customerUserId) {
    if (bookingRealtimeEventBelongsToCustomer(event, customerUserId))
        return true;
    const bookingId = String(event.bookingId || event.payload?.bookingId || event.payload?.serviceRequestId || event.payload?.id || "").trim();
    if (!bookingId)
        return false;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId))
        return false;
    return customerCanAccessBooking(bookingId, customerUserId);
}
async function customerCanAccessBooking(bookingId, customerUserId) {
    const result = await pool.query(`
      select exists (
        select 1
        from zigo.service_requests sr
        join zigo.customers cu on cu.id = sr.customer_id
        where sr.id = $1::uuid
          and cu.user_id = $2::uuid
      ) as "exists"
    `, [bookingId, customerUserId]);
    return Boolean(result.rows[0]?.exists);
}
async function listCustomerBookingRealtimeEventsAfter(customerUserId, lastEventId, limit = 100) {
    const afterId = Math.max(0, Math.floor(Number(lastEventId || 0)) || 0);
    const result = await pool.query(`
    select e.id, e.event_type as "eventType", e.booking_id as "bookingId",
      e.assistant_id as "assistantId", e.cluster_id as "clusterId", e.tab, e.message,
      e.payload, e.created_at as "createdAt"
    from zigo.booking_realtime_events e
    join zigo.service_requests sr on sr.id = e.booking_id
    join zigo.customers cu on cu.id = sr.customer_id
    where e.id > $1 and cu.user_id = $2::uuid
    order by e.id asc
    limit $3
  `, [afterId, customerUserId, Math.max(1, Math.min(500, limit))]);
    return result.rows.map((row) => ({
        id: String(row.id), type: row.eventType, bookingId: row.bookingId ?? undefined,
        assistantId: row.assistantId ?? undefined, clusterId: row.clusterId ?? undefined,
        tab: row.tab ?? undefined, message: row.message ?? undefined,
        payload: row.payload ?? {}, createdAt: new Date(row.createdAt).toISOString()
    }));
}
async function listAssistantBookingRealtimeEventsAfter(assistantId, lastEventId, limit = 100) {
    const afterId = Math.max(0, Math.floor(Number(lastEventId || 0)) || 0);
    const result = await pool.query(`
    select e.id, e.event_type as "eventType", e.booking_id as "bookingId", e.assistant_id as "assistantId", e.cluster_id as "clusterId", e.tab, e.message, e.payload, e.created_at as "createdAt"
    from zigo.booking_realtime_events e
    where e.id > $1 and (e.assistant_id = $2::uuid or nullif(e.payload->>'assistantId','') = $2::text or exists (select 1 from zigo.task_assignments ta where ta.assistant_id=$2::uuid and (ta.service_request_id=e.booking_id or ta.request_id=e.booking_id)))
    order by e.id asc limit $3
  `, [afterId, assistantId, Math.max(1, Math.min(500, limit))]);
    return result.rows.map((row) => ({ id: String(row.id), type: row.eventType, bookingId: row.bookingId ?? undefined, assistantId: row.assistantId ?? undefined, clusterId: row.clusterId ?? undefined, tab: row.tab ?? undefined, message: row.message ?? undefined, payload: row.payload ?? {}, createdAt: new Date(row.createdAt).toISOString() }));
}
portalRouter.get("/config", async (_req, res, next) => {
    try {
        res.json({ data: await getPortalConfig() });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/assistant/events", async (req, res, next) => {
    try {
        const auth = verifyPortalToken(portalRealtimeToken(req), "assistant");
        const me = await getPortalMe({ userId: auth.userId, actor: "assistant" });
        if (!me.assistantId)
            throw new HttpError(404, "Assistant profile not found.");
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
        req.socket?.setNoDelay(true);
        req.socket?.setKeepAlive(true);
        req.socket?.setTimeout(0);
        res.socket?.setTimeout(0);
        res.flushHeaders();
        res.write("retry: 1000\n\n");
        res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
        res.flush?.();
        addBookingRealtimeClient();
        let cleanedUp = false;
        let keepAlive = null;
        let unsubscribe = () => { };
        const cleanup = () => { if (cleanedUp)
            return; cleanedUp = true; if (keepAlive)
            clearInterval(keepAlive); unsubscribe(); removeBookingRealtimeClient(); };
        let lastDeliveredEventId = "";
        const sendEvent = (event, replayed = false) => {
            // Always move the cursor past scanned records, including other assistants' events.
            lastDeliveredEventId = String(event.id || lastDeliveredEventId);
            if (!(event.type === 'user.session.revoked' && event.payload?.userId === auth.userId) && !bookingRealtimeEventBelongsToAssistant(event, me.assistantId))
                return false;
            if (res.writableEnded || res.destroyed)
                return false;
            res.write(`id: ${event.id}\n`);
            res.write("event: assistant_task_changed\n");
            res.write(`data: ${JSON.stringify({ ...event, replayed })}\n\n`);
            res.flush?.();
            return true;
        };
        unsubscribe = onBookingRealtimeEvent((event) => sendEvent(event));
        const lastEventId = req.header("last-event-id") || (typeof req.query.lastEventId === "string" ? req.query.lastEventId : "");
        const missedEvents = await listAssistantBookingRealtimeEventsAfter(me.assistantId, lastEventId, 100);
        for (const event of missedEvents)
            sendEvent(event, true);
        keepAlive = setInterval(() => {
            if (res.writableEnded || res.destroyed)
                return;
            void listAssistantBookingRealtimeEventsAfter(me.assistantId, lastDeliveredEventId || lastEventId, 100).then((events) => {
                for (const event of events)
                    sendEvent(event, true);
                if (res.writableEnded || res.destroyed)
                    return;
                res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
                res.flush?.();
            }).catch(() => undefined);
        }, 10000);
        req.on("close", cleanup);
        res.on("close", cleanup);
        res.on("error", cleanup);
    }
    catch (error) {
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
        req.socket?.setTimeout(0);
        res.socket?.setTimeout(0);
        res.flushHeaders();
        res.write("retry: 1000\n\n");
        res.flush?.();
        const sendSessionRevoked = (error) => {
            const status = error instanceof HttpError ? error.statusCode : 401;
            res.write(`event: customer_session_revoked\ndata: ${JSON.stringify({
                at: new Date().toISOString(),
                status,
                message: error instanceof Error ? error.message : "Customer session expired."
            })}\n\n`);
            res.flush?.();
        };
        try {
            await getPortalMe({ userId: auth.userId, actor: "customer" });
        }
        catch (error) {
            sendSessionRevoked(error);
            res.end();
            return;
        }
        res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
        res.flush?.();
        addBookingRealtimeClient();
        let cleanedUp = false;
        let keepAlive = null;
        const cleanup = () => {
            if (cleanedUp)
                return;
            cleanedUp = true;
            if (keepAlive)
                clearInterval(keepAlive);
            unsubscribe();
            removeBookingRealtimeClient();
        };
        let lastDeliveredEventId = "";
        const sendEvent = async (event, replayed = false) => {
            // Advance the durable cursor for every scanned event. Otherwise, a customer can
            // get stuck replaying unrelated bookings and never reach their own latest event.
            lastDeliveredEventId = String(event.id || lastDeliveredEventId);
            if (event.type === 'user.session.revoked' && event.payload?.userId === auth.userId) {
                sendSessionRevoked(new HttpError(401, 'Account access ended.'));
                res.end();
                return true;
            }
            if (!await bookingRealtimeEventBelongsToCustomerAsync(event, auth.userId))
                return false;
            if (res.writableEnded || res.destroyed)
                return false;
            res.write(`id: ${event.id}\n`);
            res.write("event: customer_booking_changed\n");
            res.write(`data: ${JSON.stringify({ ...event, replayed })}\n\n`);
            res.flush?.();
            return true;
        };
        const unsubscribe = onBookingRealtimeEvent((event) => {
            void sendEvent(event).catch(() => undefined);
        });
        const lastEventId = req.header("last-event-id") || (typeof req.query.lastEventId === "string" ? req.query.lastEventId : "");
        void listCustomerBookingRealtimeEventsAfter(auth.userId, lastEventId, 100)
            .then(async (missedEvents) => {
            for (const event of missedEvents) {
                if (res.writableEnded || res.destroyed)
                    break;
                await sendEvent(event, true);
            }
        })
            .catch(() => undefined);
        keepAlive = setInterval(() => {
            if (res.writableEnded || res.destroyed)
                return;
            assertActivePortalSession(auth.userId, "customer")
                .then(async () => {
                if (res.writableEnded || res.destroyed)
                    return;
                // Redis normally delivers immediately. Replay persisted events here only
                // as a durable safety net for a missed cross-process publish.
                const missedEvents = await listCustomerBookingRealtimeEventsAfter(auth.userId, lastDeliveredEventId || lastEventId, 100);
                for (const event of missedEvents) {
                    if (res.writableEnded || res.destroyed)
                        break;
                    await sendEvent(event, true);
                }
                if (res.writableEnded || res.destroyed)
                    return;
                res.write(`: keep-alive\n\n`);
                res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString(), stats: getBookingRealtimeStats() })}\n\n`);
                res.flush?.();
            })
                .catch((error) => {
                if (res.writableEnded || res.destroyed)
                    return;
                if (!(error instanceof HttpError) || ![401, 403, 404].includes(error.statusCode))
                    return;
                sendSessionRevoked(error);
                cleanup();
                res.end();
            });
        }, 10000);
        req.on("close", cleanup);
        res.on("close", cleanup);
        res.on("error", cleanup);
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/:actor/session/refresh", async (req, res, next) => {
    try {
        const params = actorParamsSchema.parse(req.params);
        const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
        res.json({ data: await refreshPortalSession({ actor: params.actor, refreshToken: body.refreshToken }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/:actor/code/send", async (req, res, next) => {
    try {
        const params = actorParamsSchema.parse(req.params);
        const body = codeRequestBodySchema.parse(req.body);
        res.status(201).json({ data: await requestPortalCode({ actor: params.actor, ...body }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/:actor/code/verify", async (req, res, next) => {
    try {
        const params = actorParamsSchema.parse(req.params);
        const body = codeVerifyBodySchema.parse(req.body);
        res.json({ data: await verifyPortalCode({ actor: params.actor, ...body }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/assistant/password/login", async (req, res, next) => {
    try {
        const body = assistantPasswordLoginBodySchema.parse(req.body);
        res.json({ data: await loginAssistantPortalWithPassword(body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/assistant/password-reset/send", async (req, res, next) => {
    try {
        const body = assistantPasswordResetSendBodySchema.parse(req.body);
        res.status(201).json({ data: await sendAssistantPasswordResetCode(body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/assistant/password-reset/verify", async (req, res, next) => {
    try {
        const body = assistantPasswordResetVerifyBodySchema.parse(req.body);
        res.json({ data: await verifyAssistantPasswordResetCode(body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/login-categories", async (_req, res, next) => {
    try {
        const result = await pool.query(`
        select
          c.id,
          c.code,
          c.name,
          c.image_url as "imageUrl",
          c.priority,
          c.sort_order as "sortOrder"
        from zigo.categories c
        where coalesce(c.is_deleted, false) = false
          and c.service_id is null
          and c.parent_category_id is null
          and coalesce(c.is_active, true) = true
          and coalesce(c.is_enabled, true) = true
        order by c.priority, c.sort_order, c.name
        limit 24
      `);
        res.json({ data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/me", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await getPortalMe({ userId: req.portalAuth.userId, actor: "customer" }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.put("/customer/profile", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerProfileBodySchema.parse(req.body);
        res.json({ data: await updateCustomerPortalProfile(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/assistant/me", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        res.json({ data: await getPortalMe({ userId: req.portalAuth.userId, actor: "assistant" }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/wallet", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await getCustomerPortalWallet(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/wallet/transactions", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const query = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(5).max(50).default(20) }).parse(req.query);
        const result = await listCustomerPortalWalletTransactions(req.portalAuth.userId, query);
        res.json({ data: result.data, wallet: result.wallet, pagination: result.pagination });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/wallet/transactions/:transactionId", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ transactionId: z.string().uuid() }).parse(req.params);
        res.json({ data: await getCustomerPortalWalletTransaction(req.portalAuth.userId, params.transactionId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/bookings", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const query = customerBookingsQuerySchema.parse(req.query);
        const result = await listCustomerPortalBookings(req.portalAuth.userId, query);
        res.json({ data: result.data, pagination: result.pagination });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/assistants", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await listCustomerPortalAssistants(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/support/tickets", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const result = await listCustomerSupportTickets(req.portalAuth.userId, customerSupportListSchema.parse(req.query));
        res.json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/support/tickets", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const result = await createCustomerSupportTicket(req.portalAuth.userId, customerSupportTicketSchema.parse(req.body));
        if (result.created || result.messageAdded) {
            await emitBookingRealtimeEvent({
                type: result.created ? "support.ticket.created" : "support.message.created",
                message: result.created ? "New customer support ticket created." : "Customer continued an existing support ticket.",
                payload: { ticketId: result.ticket.id, customerUserId: req.portalAuth.userId }
            });
        }
        res.status(result.created ? 201 : 200).json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/support/tickets/:ticketId", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const { ticketId } = customerSupportParamsSchema.parse(req.params);
        res.json({ data: await getCustomerSupportTicket(req.portalAuth.userId, ticketId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/support/tickets/:ticketId/messages", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const { ticketId } = customerSupportParamsSchema.parse(req.params);
        const result = await addCustomerSupportMessage(req.portalAuth.userId, ticketId, customerSupportMessageSchema.parse(req.body));
        await emitBookingRealtimeEvent({
            type: "support.message.created",
            message: "Customer replied to a support ticket.",
            payload: { ticketId, customerUserId: req.portalAuth.userId, actor: "customer" }
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await getCustomerPortalCart(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.put("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerCartBodySchema.parse(req.body);
        res.json({ data: await saveCustomerPortalCart(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/cart/items", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerCartItemBodySchema.parse(req.body);
        res.json({ data: await addCustomerPortalCartItem(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.delete("/customer/cart/items", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerCartDeleteItemBodySchema.parse(req.body);
        res.json({ data: await deleteCustomerPortalCartItem(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.delete("/customer/cart", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await saveCustomerPortalCart(req.portalAuth.userId, { cartItems: [], customerNote: "" }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.put("/customer/favorites", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerFavoritesBodySchema.parse(req.body);
        res.json({ data: await saveCustomerPortalFavorites(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/catalog", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const query = customerCatalogQuerySchema.parse(req.query);
        res.json({ data: await getCustomerPortalCatalog(query) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/locations/search", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const query = locationSearchQuerySchema.parse(req.query);
        res.json({ data: await searchCustomerPortalLocations(query.q) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/locations/reverse", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const query = reverseLocationQuerySchema.parse(req.query);
        res.json({ data: await reverseCustomerPortalLocation(query) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/assistant/locations/reverse", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        const query = reverseLocationQuerySchema.parse(req.query);
        res.json({ data: await reverseCustomerPortalLocation(query) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/locations/validate", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerLocationValidationBodySchema.parse(req.body);
        res.json({ data: await validateCustomerPortalLocation(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/locations/validate-route", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = z.object({ locations: z.array(customerLocationValidationBodySchema).min(1).max(50) }).parse(req.body);
        const locations = await Promise.all(body.locations.map((location) => validateCustomerPortalLocation(req.portalAuth.userId, location)));
        const clusterIds = locations.flatMap((location) => location.cluster ? [location.cluster.clusterId] : []);
        const isServiceable = locations.every((location) => location.isServiceable) && await locationClustersCanInterserve(clusterIds);
        res.json({ data: { isServiceable } });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/unserviceable-locations", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerUnserviceableLocationBodySchema.parse(req.body);
        res.status(201).json({ data: await recordCustomerPortalUnserviceableLocation(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/locations/service-boundaries", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await listCustomerPortalServiceBoundaries(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/addresses", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await listCustomerPortalAddresses(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/default-location", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await getCustomerPortalDefaultLocation(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/previous-used-locations", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        res.json({ data: await listCustomerPortalPreviousUsedLocations(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/previous-used-locations", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerPreviousUsedLocationBodySchema.parse(req.body);
        res.status(201).json({ data: await saveCustomerPortalPreviousUsedLocation(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/addresses", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerAddressBodySchema.parse(req.body);
        res.status(201).json({ data: await saveCustomerPortalAddress(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/default-location", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerAddressBodySchema.pick({
            address: true,
            latitude: true,
            longitude: true,
            landmark: true,
            personName: true,
            contactNumber: true,
            stateName: true,
            cityName: true,
            postalCode: true,
            source: true
        }).parse(req.body);
        res.status(201).json({ data: await saveCustomerPortalDefaultLocation(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.put("/customer/addresses/:addressId", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = customerAddressParamsSchema.parse(req.params);
        const body = customerAddressBodySchema.parse(req.body);
        res.json({ data: await updateCustomerPortalAddress(req.portalAuth.userId, params.addressId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.delete("/customer/addresses/:addressId", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = customerAddressParamsSchema.parse(req.params);
        const deleted = await deleteCustomerPortalAddress(req.portalAuth.userId, params.addressId);
        if (!deleted)
            throw new HttpError(404, "Customer address not found.");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/addresses/:addressId/default", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = customerAddressParamsSchema.parse(req.params);
        res.json({ data: await setCustomerPortalDefaultAddress(req.portalAuth.userId, params.addressId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/payments/razorpay/orders", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = razorpayOrderBodySchema.parse(req.body);
        res.status(201).json({ data: await createRazorpayPaymentOrder({ ...body, customerUserId: req.portalAuth.userId }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/payments/razorpay/verify", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = razorpayVerifyBodySchema.parse(req.body);
        res.json({ data: await verifyAndSaveRazorpayPayment({ ...body, customerUserId: req.portalAuth.userId }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/payments/razorpay/orders/:orderId/status", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ orderId: z.string().trim().min(1).max(100) }).parse(req.params);
        res.json({
            data: await getCustomerRazorpayOrderStatus({
                customerUserId: req.portalAuth.userId,
                orderId: params.orderId
            })
        });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const booking = await createCustomerPortalBooking(req.portalAuth.userId, bookingBodySchema.parse(req.body));
        await emitBookingRealtimeEvent({
            type: "booking.created",
            bookingId: booking.id,
            tab: "pending_assign",
            message: "New customer portal booking created",
            payload: { bookingId: booking.id, source: "customer_portal", customerUserId: req.portalAuth.userId }
        });
        pokeBookingOrchestrationWorker("customer_booking_created");
        res.status(201).json({ data: booking });
        pokeBookingInvoiceEmailWorker();
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/availability", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerBookingAvailabilityBodySchema.parse(req.body);
        res.json({ data: await getCustomerPortalBookingAvailability(req.portalAuth.userId, body) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/customer/bookings/:bookingId", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        res.json({ data: await getCustomerPortalBooking(req.portalAuth.userId, params.bookingId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/extensions/razorpay-order", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = z.object({ durationMinutes: z.coerce.number().int().min(1).max(240) }).parse(req.body);
        res.status(201).json({ data: await createCustomerPortalBookingAddOnOrder(req.portalAuth.userId, { bookingId: params.bookingId, kind: "extension", durationMinutes: body.durationMinutes }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/extensions/cash", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = z.object({ durationMinutes: z.coerce.number().int().min(1).max(240) }).parse(req.body);
        const data = await createCustomerPortalCashExtension(req.portalAuth.userId, { bookingId: params.bookingId, durationMinutes: body.durationMinutes });
        await emitBookingRealtimeEvent({ type: "booking.updated", bookingId: params.bookingId, message: "Service extension added for cash payment", payload: { bookingId: params.bookingId, customerUserId: req.portalAuth.userId, addOn: data } });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/tips/razorpay-order", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = z.object({ amountPaise: z.coerce.number().int().min(2000).max(100000) }).parse(req.body);
        res.status(201).json({ data: await createCustomerPortalTipOrder(req.portalAuth.userId, { bookingId: params.bookingId, amountPaise: body.amountPaise }) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/add-ons/:addOnId/complete", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid(), addOnId: z.string().uuid() }).parse(req.params);
        const data = await completeCustomerPortalBookingAddOn(req.portalAuth.userId, params);
        await emitBookingRealtimeEvent({ type: "booking.updated", bookingId: params.bookingId, message: data.kind === "tip" ? "Customer tip paid" : "Service extension paid", payload: { bookingId: params.bookingId, customerUserId: req.portalAuth.userId, addOn: data } });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.patch("/customer/bookings/:bookingId/tip", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = customerBookingTipBodySchema.parse(req.body);
        const data = await updateCustomerPortalBookingTip(req.portalAuth.userId, { bookingId: params.bookingId, amountPaise: body.amountPaise });
        await emitBookingRealtimeEvent({
            type: "booking.updated",
            bookingId: params.bookingId,
            message: "Customer updated booking tip",
            payload: { bookingId: params.bookingId, tipAmountPaise: data.tipAmountPaise, grandTotalPaise: data.grandTotalPaise }
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/bookings/:bookingId/sync", requirePortalAuth(), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const auth = req.portalAuth;
        if (auth.actor === "customer") {
            const allowed = await customerCanAccessBooking(params.bookingId, auth.userId);
            if (!allowed)
                throw new HttpError(404, "Booking not found.");
        }
        else {
            const allowed = await pool.query(`
          select exists (
            select 1
            from zigo.task_assignments ta
            join zigo.assistants a on a.id = ta.assistant_id
            where ta.service_request_id = $1::uuid
              and a.user_id = $2::uuid
          ) as "exists"
        `, [params.bookingId, auth.userId]);
            if (!allowed.rows[0]?.exists)
                throw new HttpError(404, "Booking not found.");
        }
        const settings = await getBookingEngineSetting();
        const changes = settings.isEnabled && settings.orchestrationWorkerEnabled
            ? await runBookingOrchestrationCycle(undefined, settings.batchSize || 100, {
                riskLookaheadMinutes: settings.riskLookaheadMinutes,
                slaGraceMinutes: settings.slaGraceMinutes,
                customerAssistantDelayAutoCancelMinutes: settings.customerAssistantDelayAutoCancelMinutes
            })
            : [];
        const relatedChanges = changes.filter((change) => change.serviceRequestId === params.bookingId);
        for (const change of relatedChanges) {
            await emitBookingRealtimeEvent({
                type: change.eventType || "booking.updated",
                bookingId: change.serviceRequestId,
                assistantId: change.assistantId ?? undefined,
                clusterId: change.clusterId,
                message: change.message,
                payload: change
            });
        }
        if (relatedChanges.length)
            pokeBookingOrchestrationWorker("portal_booking_sync");
        res.json({ data: { bookingId: params.bookingId, synced: true, changes: relatedChanges } });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/bookings/:bookingId/quick-replies", requirePortalAuth(), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        res.json(await listPortalBookingQuickReplies(req.portalAuth.userId, req.portalAuth.actor, params.bookingId));
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/cancel", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = cancelBookingBodySchema.parse(req.body);
        const data = await cancelCustomerPortalBooking(req.portalAuth.userId, { bookingId: params.bookingId, reason: body.reason });
        await emitBookingRealtimeEvent({
            type: "booking.cancelled",
            bookingId: data.bookingId,
            assistantId: data.assistantId ?? undefined,
            tab: "cancelled",
            message: "Customer cancelled booking",
            payload: {
                bookingId: data.bookingId,
                customerUserId: req.portalAuth.userId,
                assistantId: data.assistantId,
                reason: body.reason,
                reasonCode: data.reasonCode,
                delayMinutes: data.delayMinutes,
                source: "customer_portal"
            }
        });
        pokeBookingOrchestrationWorker("customer_booking_cancelled");
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/bookings/:bookingId/review", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ bookingId: z.string().uuid() }).parse(req.params);
        const body = customerBookingReviewBodySchema.parse(req.body);
        const data = await saveCustomerPortalBookingReview(req.portalAuth.userId, { bookingId: params.bookingId, ...body });
        await emitBookingRealtimeEvent({
            type: "booking.updated",
            bookingId: params.bookingId,
            message: "Customer submitted booking review",
            payload: {
                bookingId: params.bookingId,
                customerUserId: req.portalAuth.userId,
                reviewId: data.id,
                source: "customer_portal"
            }
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/customer/disputes", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const body = customerDisputeBodySchema.parse(req.body);
        const data = await createCustomerPortalDispute(req.portalAuth.userId, body);
        await emitBookingRealtimeEvent({
            type: "booking.updated",
            bookingId: body.bookingId,
            message: "Customer dispute opened",
            payload: {
                bookingId: body.bookingId,
                disputeId: data.id,
                customerUserId: req.portalAuth.userId,
                source: "customer_portal"
            }
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.get("/assistant/tasks", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        res.json({ data: await listAssistantPortalTasks(req.portalAuth.userId) });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/internal/tracking/authorize", async (req, res, next) => {
    try {
        const internalToken = req.header("x-zigo-tracking-gateway");
        if (!env.TRACKING_GATEWAY_INTERNAL_TOKEN || internalToken !== env.TRACKING_GATEWAY_INTERNAL_TOKEN) {
            throw new HttpError(404, "Not found.");
        }
        const body = z.object({
            bookingId: z.string().uuid(),
            accessToken: z.string().min(1)
        }).parse(req.body);
        const auth = verifyPortalToken(body.accessToken);
        await assertActivePortalSession(auth.userId, auth.actor);
        if (auth.actor === "customer") {
            await getCustomerPortalBooking(auth.userId, body.bookingId);
            res.json({ data: { authorized: true, actor: auth.actor } });
            return;
        }
        const tasks = await listAssistantPortalTasks(auth.userId);
        const authorized = tasks.some((task) => String(task.bookingId || task.serviceRequestId || "") === body.bookingId);
        if (!authorized)
            throw new HttpError(403, "Booking access denied.");
        res.json({ data: { authorized: true, actor: auth.actor } });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.patch("/assistant/availability", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        const body = onlineBodySchema.parse(req.body);
        const data = await setAssistantPortalOnline(req.portalAuth.userId, body.isOnline, body);
        await emitBookingRealtimeEvent({
            type: "assistant.availability.changed",
            assistantId: data.assistantId,
            message: body.isOnline ? "Assistant is online" : "Assistant is offline",
            payload: { assistantId: data.assistantId, isOnline: body.isOnline, latitude: body.latitude ?? null, longitude: body.longitude ?? null }
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/assistant/location-pings", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        const body = assistantLocationBodySchema.parse(req.body);
        const data = await recordAssistantPortalLocationPing(req.portalAuth.userId, body);
        if (data.bookingId) {
            await enqueueTrackingOutboxEvent({
                type: "assistant.location.updated",
                bookingId: data.bookingId,
                assistantId: data.assistantId,
                dedupeKey: `assistant-location:${data.id}`,
                payload: {
                    bookingId: data.bookingId,
                    assignmentId: data.assignmentId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracyMeters: data.accuracyMeters,
                    capturedAt: data.capturedAt
                }
            });
            await emitBookingRealtimeEvent({
                type: "booking.updated",
                bookingId: data.bookingId,
                assistantId: data.assistantId,
                message: "Assistant location updated",
                payload: { bookingId: data.bookingId, serviceRequestId: data.bookingId, assistantId: data.assistantId, liveRoutePing: data }
            });
        }
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.patch("/assistant/tasks/:assignmentId/status", requirePortalAuth("assistant"), async (req, res, next) => {
    try {
        const params = z.object({ assignmentId: z.string().uuid() }).parse(req.params);
        const body = taskStatusBodySchema.parse(req.body);
        const data = await updateAssistantPortalTaskStatus(req.portalAuth.userId, { assignmentId: params.assignmentId, status: body.status, pin: body.pin });
        await emitBookingRealtimeEvent({
            type: "booking.updated",
            bookingId: data.bookingId,
            assistantId: data.assistantId,
            message: `Assistant task ${body.status.replace("_", " ")}`,
            payload: data
        });
        pokeBookingOrchestrationWorker("assistant_task_status_changed");
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/task-updates", requirePortalAuth(), async (req, res, next) => {
    try {
        const body = taskUpdateBodySchema.parse(req.body);
        const data = await createPortalTaskUpdate({
            userId: req.portalAuth.userId,
            actor: req.portalAuth.actor,
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
                actor: req.portalAuth.actor,
                updateType: body.updateType,
                paymentStatus: body.updateType === "payment_received"
                    ? "paid"
                    : body.updateType === "payment_response" && req.portalAuth.actor === "assistant" && String(body.metadata?.response || "").toLowerCase() === "no"
                        ? "due"
                        : body.updateType === "payment_response"
                            ? "pending"
                            : undefined,
                assistantId: data.assistantId,
                customerUserId: data.customerUserId
            }
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/task-updates/read", requirePortalAuth(), async (req, res, next) => {
    try {
        const body = taskUpdateReadBodySchema.parse(req.body);
        const data = await markPortalBookingTaskUpdatesRead(req.portalAuth.userId, req.portalAuth.actor, body.bookingId);
        res.json({ data });
    }
    catch (error) {
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
            actorUserId: req.portalAuth.userId,
            maxBytes: body.context === "booking" ? 2 * 1024 * 1024 : undefined,
            maxSizeLabel: body.context === "booking" ? "2 MB" : undefined
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
portalRouter.post("/task-updates/:updateId/approve-time", requirePortalAuth("customer"), async (req, res, next) => {
    try {
        const params = z.object({ updateId: z.string().uuid() }).parse(req.params);
        const data = await approvePortalTimeExtension(req.portalAuth.userId, params.updateId);
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
    }
    catch (error) {
        next(error);
    }
});
