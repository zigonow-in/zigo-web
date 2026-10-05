import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { generateZigoBookingReference, isZigoBookingReference, zigoServiceTypeCode } from "../../utils/bookingReference.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";

type Queryable = Pick<typeof pool, "query">;

let razorpayClient: Razorpay | null = null;
let schemaReady: Promise<void> | null = null;

function razorpayCredentials() {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new HttpError(500, "Razorpay is not configured.");
  return { keyId, keySecret };
}

function razorpayWebhookSecret() {
  const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new HttpError(500, "Razorpay webhook secret is not configured.");
  return secret;
}

function getRazorpayClient() {
  const { keyId, keySecret } = razorpayCredentials();
  if (!razorpayClient) razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpayClient;
}

export function ensurePaymentsSchema(client: Queryable = pool) {
  if (client === pool && schemaReady) return schemaReady;
  const promise = client.query(`
    create table if not exists zigo.razorpay_payments (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid references zigo.service_requests(id) on delete set null,
      customer_user_id uuid references zigo.users(id) on delete set null,
      provider_order_id text not null unique,
      provider_payment_id text,
      amount_paise integer not null,
      currency text not null default 'INR',
      receipt text,
      status_code text not null default 'pending',
      method text,
      bank text,
      wallet text,
      vpa text,
      email text,
      contact text,
      error_code text,
      error_description text,
      captured_at timestamptz,
      verified_at timestamptz,
      last_reconciled_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      raw_order jsonb not null default '{}'::jsonb,
      raw_payment jsonb not null default '{}'::jsonb,
      webhook_payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists zigo.razorpay_webhook_events (
      id uuid primary key default gen_random_uuid(),
      event_id text,
      event_name text not null,
      provider_order_id text,
      provider_payment_id text,
      payload jsonb not null,
      processed_at timestamptz,
      received_at timestamptz not null default now(),
      unique(event_id)
    );
    create table if not exists zigo.razorpay_downtimes (
      id text primary key,
      method text,
      status_code text,
      severity text,
      instrument jsonb not null default '{}'::jsonb,
      begin_at timestamptz,
      end_at timestamptz,
      payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    alter table zigo.service_requests
      add column if not exists payment_details jsonb not null default '{}'::jsonb,
      add column if not exists payment_status text not null default 'due',
      add column if not exists payment_type text not null default 'cash',
      add column if not exists is_paid boolean not null default false;
    create index if not exists idx_razorpay_payments_booking on zigo.razorpay_payments(service_request_id, created_at desc);
    create index if not exists idx_razorpay_payments_status on zigo.razorpay_payments(status_code, updated_at desc);
    create index if not exists idx_razorpay_payments_payment on zigo.razorpay_payments(provider_payment_id);
    create index if not exists idx_razorpay_webhook_order on zigo.razorpay_webhook_events(provider_order_id, received_at desc);
  `).then(() => undefined);
  if (client === pool) schemaReady = promise;
  return promise;
}

function paymentEntityFromWebhook(payload: Record<string, any>) {
  return payload?.payload?.payment?.entity || payload?.payload?.order?.entity?.payments?.[0] || null;
}

function orderEntityFromWebhook(payload: Record<string, any>) {
  return payload?.payload?.order?.entity || null;
}

function mapRazorpayStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "captured" || value === "paid") return "paid";
  if (value === "authorized") return "processing";
  if (value === "failed") return "failed";
  if (value === "created") return "pending";
  return value || "pending";
}

function bookingPaymentStatus(status = "") {
  const mapped = mapRazorpayStatus(status);
  if (mapped === "paid") return "paid";
  if (mapped === "failed") return "failed";
  if (mapped === "processing") return "processing";
  return "pending";
}

function pickBestRazorpayPayment(payments: any[] = []) {
  const rank: Record<string, number> = { captured: 4, paid: 4, authorized: 3, pending: 2, created: 1, failed: 0 };
  return [...payments].sort((left, right) => {
    const leftRank = rank[String(left?.status || "").toLowerCase()] ?? 1;
    const rightRank = rank[String(right?.status || "").toLowerCase()] ?? 1;
    if (leftRank !== rightRank) return rightRank - leftRank;
    return Number(right?.created_at || 0) - Number(left?.created_at || 0);
  })[0] || null;
}

function safeJson(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {});
}

async function updateBookingPaymentFromRazorpay(client: Queryable, orderId: string, statusCode: string, details: Record<string, unknown>) {
  const payment = await client.query<{ bookingId: string | null; metadata: Record<string, unknown> | null }>(`select service_request_id as "bookingId", metadata from zigo.razorpay_payments where provider_order_id = $1 limit 1`,
    [orderId]
  );
  const bookingId = payment.rows[0]?.bookingId;
  const paymentMetadata = payment.rows[0]?.metadata && typeof payment.rows[0].metadata === "object" ? payment.rows[0].metadata : {};
  if ((paymentMetadata as Record<string, unknown>).addOnKind || !bookingId) return null;
  const paymentStatus = bookingPaymentStatus(statusCode);
  const isPaid = paymentStatus === "paid";
  const canonicalPaymentDetails = {
    ...details,
    paymentType: "razorpay",
    paymentStatus,
    isPaid
  };
  const updated = await client.query<{
    id: string;
    customerUserId: string | null;
    assistantId: string | null;
    clusterId: string | null;
    paymentStatus: string;
    paymentType: string;
    isPaid: boolean;
  }>(
    `
      update zigo.service_requests sr
      set payment_type = 'razorpay',
          payment_status = $2::text,
          is_paid = $3::boolean,
          payment_details = coalesce(sr.payment_details, '{}'::jsonb) || $4::jsonb,
          metadata = coalesce(sr.metadata, '{}'::jsonb)
            || jsonb_build_object(
              'paymentType', 'razorpay',
              'paymentStatus', $2::text,
              'isPaid', $3::boolean,
              'razorpayPayment', $4::jsonb
            ),
          updated_at = now()
      where sr.id = $1::uuid
      returning sr.id,
        (select cu.user_id from zigo.customers cu where cu.id = sr.customer_id) as "customerUserId",
        (select ta.assistant_id from zigo.task_assignments ta where ta.service_request_id = sr.id order by ta.assigned_at desc nulls last, ta.id desc limit 1) as "assistantId",
        sr.cluster_id as "clusterId",
        sr.payment_status as "paymentStatus",
        sr.payment_type as "paymentType",
        sr.is_paid as "isPaid"
    `,
    [bookingId, paymentStatus, isPaid, safeJson(canonicalPaymentDetails)]
  );
  return updated.rows[0] || null;
}

async function emitPaymentRealtime(booking: Awaited<ReturnType<typeof updateBookingPaymentFromRazorpay>>, message: string) {
  if (!booking?.id) return;
  await emitBookingRealtimeEvent({
    type: "booking.updated",
    bookingId: booking.id,
    assistantId: booking.assistantId ?? undefined,
    clusterId: booking.clusterId ?? undefined,
    message,
    payload: {
      bookingId: booking.id,
      customerUserId: booking.customerUserId,
      paymentStatus: booking.paymentStatus,
      paymentType: booking.paymentType,
      isPaid: booking.isPaid
    }
  });
}

async function createUniquePaymentBookingReference(input: {
  receipt?: string;
  bookingReference?: string | null;
  bookingType?: string | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}) {
  // An add-on uses a unique provider receipt but retains the original booking reference in notes.
  const explicitReceipt = String(input.receipt || "").trim();
  if (explicitReceipt) return explicitReceipt.slice(0, 40);
  const preferred = String(input.bookingReference || "").trim();
  if (isZigoBookingReference(preferred)) return preferred;
  const serviceTypeCode = zigoServiceTypeCode(input);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateZigoBookingReference({
      serviceTypeCode,
      bookingType: input.bookingType || "instant"
    });
    const existing = await pool.query(
      `
        select 1
        from zigo.razorpay_payments
        where receipt = $1
        union all
        select 1
        from zigo.service_requests
        where request_number = $1
        limit 1
      `,
      [candidate]
    );
    if (!existing.rows.length) return candidate;
  }
  throw new HttpError(409, "Unable to generate a unique booking payment reference. Please try again.");
}

export async function createRazorpayPaymentOrder(input: {
  amountPaise: number;
  currency?: string;
  receipt?: string;
  customerUserId?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  bookingType?: string | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { keyId } = razorpayCredentials();
  await ensurePaymentsSchema();
  const amount = Math.round(Number(input.amountPaise || 0));
  if (!Number.isFinite(amount) || amount < 100) throw new HttpError(400, "Minimum payment amount is Rs 1.");
  const currency = String(input.currency || "INR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, "Invalid payment currency.");
  if (input.bookingId) {
    const ownedBooking = await pool.query(
      `
        select 1
        from zigo.service_requests sr
        join zigo.customers c on c.id = sr.customer_id
        where sr.id = $1::uuid
          and c.user_id = $2::uuid
        limit 1
      `,
      [input.bookingId, input.customerUserId]
    );
    if (!ownedBooking.rows.length) throw new HttpError(404, "Booking was not found for this customer.");
  }
  const receipt = await createUniquePaymentBookingReference(input);
  const bookingReference = String(input.bookingReference || input.receipt || receipt).trim() || receipt;
  try {
    const order = await getRazorpayClient().orders.create({
      amount,
      currency,
      receipt,
      notes: {
        source: "zigo",
        customerUserId: input.customerUserId || "",
        bookingId: input.bookingId || "",
        bookingReference
      }
    });
    await pool.query(
      `
        insert into zigo.razorpay_payments
          (service_request_id, customer_user_id, provider_order_id, amount_paise, currency, receipt, status_code, metadata, raw_order)
        values ($1, $2, $3, $4, $5, $6, 'pending', $7::jsonb, $8::jsonb)
        on conflict (provider_order_id) do update
        set amount_paise = excluded.amount_paise,
            currency = excluded.currency,
            receipt = excluded.receipt,
            metadata = zigo.razorpay_payments.metadata || excluded.metadata,
            raw_order = excluded.raw_order,
            updated_at = now()
      `,
      [input.bookingId || null, input.customerUserId || null, order.id, Number(order.amount || amount), order.currency || currency, order.receipt || receipt, safeJson(input.metadata || {}), safeJson(order)]
    );
    return {
      keyId,
      orderId: order.id,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      bookingReference: receipt,
      paymentStatus: "pending"
    };
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 500);
    if (statusCode === 401) throw new HttpError(401, "Razorpay authentication failed.");
    throw new HttpError(500, "Unable to create Razorpay order.");
  }
}

export async function verifyAndSaveRazorpayPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  customerUserId?: string | null;
}) {
  const { keySecret } = razorpayCredentials();
  await ensurePaymentsSchema();
  const orderId = String(input.razorpay_order_id || "").trim();
  const paymentId = String(input.razorpay_payment_id || "").trim();
  const signature = String(input.razorpay_signature || "").trim();
  if (!orderId || !paymentId || !signature) throw new HttpError(400, "Missing Razorpay payment verification fields.");
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new HttpError(400, "Payment signature verification failed.");
  }
  const ownedOrder = await pool.query<{ customerUserId: string | null }>(
    `select customer_user_id as "customerUserId" from zigo.razorpay_payments where provider_order_id = $1 limit 1`,
    [orderId]
  );
  if (!ownedOrder.rows.length || (input.customerUserId && ownedOrder.rows[0]?.customerUserId !== input.customerUserId)) {
    throw new HttpError(404, "Payment order was not found for this customer.");
  }
  const payment = await getRazorpayClient().payments.fetch(paymentId) as any;
  const statusCode = mapRazorpayStatus(payment.status);
  const savedPayment = await pool.query<{ statusCode: string }>(
    `
      update zigo.razorpay_payments
      set provider_payment_id = $2,
          status_code = case when status_code = 'paid' then 'paid' else $3 end,
          method = $4,
          bank = $5,
          wallet = $6,
          vpa = $7,
          email = $8,
          contact = $9,
          error_code = $10,
          error_description = $11,
          raw_payment = $12::jsonb,
          verified_at = now(),
          captured_at = case when $3 = 'paid' then now() else captured_at end,
          updated_at = now()
      where provider_order_id = $1
      returning status_code as "statusCode"
    `,
    [orderId, paymentId, statusCode, payment.method || null, payment.bank || null, payment.wallet || null, payment.vpa || null, payment.email || null, payment.contact || null, payment.error_code || null, payment.error_description || null, safeJson(payment)]
  );
  const effectiveStatusCode = savedPayment.rows[0]?.statusCode || statusCode;
  const booking = await updateBookingPaymentFromRazorpay(pool, orderId, effectiveStatusCode, {
    provider: "razorpay",
    source: "signature_verification",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    method: payment.method || null
  });
  await emitPaymentRealtime(booking, statusCode === "paid" ? "Payment received" : "Payment updated");
  const paymentStatus = bookingPaymentStatus(effectiveStatusCode);
  return {
    signatureVerified: true,
    verified: paymentStatus === "paid",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    paymentStatus,
    providerStatus: effectiveStatusCode,
    method: payment.method || null
  };
}

export async function linkRazorpayPaymentToBooking(input: {
  bookingId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}) {
  await ensurePaymentsSchema();
  const orderId = String(input.razorpayOrderId || "").trim();
  const paymentId = String(input.razorpayPaymentId || "").trim();
  if (!input.bookingId || (!orderId && !paymentId)) return null;
  const result = await pool.query<{ statusCode: string; providerOrderId: string; providerPaymentId: string | null }>(
    `
      update zigo.razorpay_payments
      set service_request_id = $1::uuid,
          updated_at = now()
      where (($2::text <> '' and provider_order_id = $2)
        or ($2::text = '' and $3::text <> '' and provider_payment_id = $3))
      returning status_code as "statusCode", provider_order_id as "providerOrderId", provider_payment_id as "providerPaymentId"
    `,
    [input.bookingId, orderId, paymentId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const details = {
    provider: "razorpay",
    razorpayOrderId: row.providerOrderId,
    razorpayPaymentId: row.providerPaymentId,
    paymentStatus: bookingPaymentStatus(row.statusCode),
    providerStatus: row.statusCode
  };
  await updateBookingPaymentFromRazorpay(pool, row.providerOrderId, row.statusCode, details);
  return details;
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature = "") {
  const expected = crypto.createHmac("sha256", razorpayWebhookSecret()).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(String(signature || ""), "hex");
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function processRazorpayWebhook(rawBody: Buffer, signature = "") {
  await ensurePaymentsSchema();
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) throw new HttpError(400, "Invalid Razorpay webhook signature.");
  const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, any>;
  const eventName = String(payload.event || "").trim();
  if (!eventName) throw new HttpError(400, "Razorpay webhook event name is missing.");
  const payment = paymentEntityFromWebhook(payload);
  const order = orderEntityFromWebhook(payload);
  const orderId = String(payment?.order_id || order?.id || "").trim();
  const paymentId = String(payment?.id || "").trim();
  const eventId = String(payload.id || `${eventName}:${orderId}:${paymentId}:${payload.created_at || Date.now()}`);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inserted = await client.query<{ id: string }>(
      `
        insert into zigo.razorpay_webhook_events
          (event_id, event_name, provider_order_id, provider_payment_id, payload, processed_at)
        values ($1, $2, $3, $4, $5::jsonb, now())
        on conflict (event_id) do nothing
        returning id
      `,
      [eventId, eventName, orderId || null, paymentId || null, safeJson(payload)]
    );
    if (!inserted.rows.length) {
      await client.query("commit");
      return { duplicate: true, event: eventName, orderId, paymentId };
    }
    let booking = null;
    if (eventName.startsWith("payment.") && payment) {
      const statusCode = mapRazorpayStatus(payment.status || (eventName === "payment.captured" ? "captured" : eventName === "payment.failed" ? "failed" : "authorized"));
      const savedPayment = await client.query<{ statusCode: string }>(
        `
          insert into zigo.razorpay_payments
            (provider_order_id, provider_payment_id, amount_paise, currency, status_code, method, bank, wallet, vpa, email, contact,
             error_code, error_description, raw_payment, webhook_payload, captured_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, case when $5 = 'paid' then now() else null end)
          on conflict (provider_order_id) do update
          set provider_payment_id = coalesce(excluded.provider_payment_id, zigo.razorpay_payments.provider_payment_id),
              status_code = case when zigo.razorpay_payments.status_code = 'paid' then 'paid' else excluded.status_code end,
              method = excluded.method,
              bank = excluded.bank,
              wallet = excluded.wallet,
              vpa = excluded.vpa,
              email = excluded.email,
              contact = excluded.contact,
              error_code = excluded.error_code,
              error_description = excluded.error_description,
              raw_payment = excluded.raw_payment,
              metadata = zigo.razorpay_payments.metadata || jsonb_build_object('lastWebhookEvent', $16::text),
              captured_at = case when excluded.status_code = 'paid' then now() else zigo.razorpay_payments.captured_at end,
              updated_at = now()
          returning status_code as "statusCode"
        `,
        [
          orderId,
          paymentId || null,
          Number(payment.amount || 0),
          payment.currency || "INR",
          statusCode,
          payment.method || null,
          payment.bank || null,
          payment.wallet || null,
          payment.vpa || null,
          payment.email || null,
          payment.contact || null,
          payment.error_code || null,
          payment.error_description || null,
          safeJson(payment),
          safeJson(payload),
          eventName
        ]
      );
      const effectiveStatusCode = savedPayment.rows[0]?.statusCode || statusCode;
      booking = await updateBookingPaymentFromRazorpay(client, orderId, effectiveStatusCode, {
        provider: "razorpay",
        source: "webhook",
        webhookEvent: eventName,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId || null,
        method: payment.method || null,
        errorCode: payment.error_code || null,
        errorDescription: payment.error_description || null
      });
    } else if (eventName.startsWith("order.") && order?.id) {
      const statusCode = mapRazorpayStatus(order.status || (eventName === "order.paid" ? "paid" : "pending"));
      const savedOrder = await client.query<{ statusCode: string }>(
        `
          update zigo.razorpay_payments
          set status_code = case when status_code = 'paid' then 'paid' else $2 end,
              raw_order = $3::jsonb,
              updated_at = now()
          where provider_order_id = $1
          returning status_code as "statusCode"
        `,
        [order.id, statusCode, safeJson(order)]
      );
      const effectiveStatusCode = savedOrder.rows[0]?.statusCode || statusCode;
      booking = await updateBookingPaymentFromRazorpay(client, order.id, effectiveStatusCode, {
        provider: "razorpay",
        source: "webhook",
        webhookEvent: eventName,
        razorpayOrderId: order.id
      });
    } else if (eventName.startsWith("payment.downtime.")) {
      const downtime = payload?.payload?.["payment.downtime"]?.entity;
      if (downtime?.id) {
        await client.query(
          `
            insert into zigo.razorpay_downtimes (id, method, status_code, severity, instrument, begin_at, end_at, payload, updated_at)
            values ($1, $2, $3, $4, $5::jsonb, to_timestamp($6), case when $7::bigint > 0 then to_timestamp($7) else null end, $8::jsonb, now())
            on conflict (id) do update
            set method = excluded.method,
                status_code = excluded.status_code,
                severity = excluded.severity,
                instrument = excluded.instrument,
                begin_at = excluded.begin_at,
                end_at = excluded.end_at,
                payload = excluded.payload,
                updated_at = now()
          `,
          [downtime.id, downtime.method || null, downtime.status || null, downtime.severity || null, safeJson(downtime.instrument || {}), Number(downtime.begin || 0), Number(downtime.end || 0), safeJson(payload)]
        );
      }
    }
    await client.query("commit");
    await emitPaymentRealtime(booking, eventName === "payment.captured" || eventName === "order.paid" ? "Payment received" : "Payment updated");
    return { processed: true, event: eventName, orderId, paymentId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listRazorpayPayments(input: { status?: string; search?: string; page?: number; pageSize?: number }) {
  await ensurePaymentsSchema();
  const page = Math.max(1, Math.round(Number(input.page || 1)));
  const pageSize = Math.max(5, Math.min(100, Math.round(Number(input.pageSize || 20))));
  const offset = (page - 1) * pageSize;
  const status = String(input.status || "all").toLowerCase();
  const search = String(input.search || "").trim();
  const params: unknown[] = [];
  const where: string[] = [];
  if (status !== "all") {
    params.push(status);
    where.push(`lower(rp.status_code) = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(
      lower(coalesce(sr.request_number, '')) like $${params.length}
      or lower(coalesce(rp.receipt, '')) like $${params.length}
      or lower(coalesce(rp.provider_order_id, '')) like $${params.length}
      or lower(coalesce(rp.provider_payment_id, '')) like $${params.length}
      or lower(coalesce(u.display_name, '')) like $${params.length}
      or lower(coalesce(u.phone, '')) like $${params.length}
    )`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const result = await pool.query(
    `
      select rp.id, rp.service_request_id as "bookingId", sr.request_number as "bookingNumber", rp.receipt,
        u.display_name as "customerName", u.phone as "customerPhone",
        rp.provider_order_id as "razorpayOrderId", rp.provider_payment_id as "razorpayPaymentId",
        rp.amount_paise as "amountPaise", rp.currency, rp.status_code as "status",
        rp.method, rp.error_description as "errorDescription",
        rp.created_at as "createdAt", rp.updated_at as "updatedAt", rp.last_reconciled_at as "lastReconciledAt"
      from zigo.razorpay_payments rp
      left join zigo.service_requests sr on sr.id = rp.service_request_id
      left join zigo.customers cu on cu.id = sr.customer_id
      left join zigo.users u on u.id = coalesce(cu.user_id, rp.customer_user_id)
      ${whereSql}
      order by rp.created_at desc
      limit $${params.length + 1} offset $${params.length + 2}
    `,
    [...params, pageSize, offset]
  );
  const total = await pool.query<{ total: string }>(
    `
      select count(*)::text as total
      from zigo.razorpay_payments rp
      left join zigo.service_requests sr on sr.id = rp.service_request_id
      left join zigo.customers cu on cu.id = sr.customer_id
      left join zigo.users u on u.id = coalesce(cu.user_id, rp.customer_user_id)
      ${whereSql}
    `,
    params
  );
  const totalRecords = Number(total.rows[0]?.total || 0);
  return {
    rows: result.rows,
    pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) }
  };
}

export async function getRazorpayPaymentDetail(paymentId: string) {
  await ensurePaymentsSchema();
  const result = await pool.query(
    `
      select rp.id, rp.service_request_id as "bookingId", sr.request_number as "bookingNumber", rp.receipt,
        u.display_name as "customerName", u.phone as "customerPhone",
        rp.provider_order_id as "razorpayOrderId", rp.provider_payment_id as "razorpayPaymentId",
        rp.amount_paise as "amountPaise", rp.currency, rp.status_code as "status",
        rp.method, rp.bank, rp.wallet, rp.vpa, rp.email, rp.contact,
        rp.error_code as "errorCode", rp.error_description as "errorDescription",
        rp.metadata, rp.raw_order as "rawOrder", rp.raw_payment as "rawPayment", rp.webhook_payload as "webhookPayload",
        rp.captured_at as "capturedAt", rp.verified_at as "verifiedAt",
        rp.created_at as "createdAt", rp.updated_at as "updatedAt", rp.last_reconciled_at as "lastReconciledAt",
        sr.payment_status as "bookingPaymentStatus", sr.payment_type as "bookingPaymentType", sr.is_paid as "bookingIsPaid"
      from zigo.razorpay_payments rp
      left join zigo.service_requests sr on sr.id = rp.service_request_id
      left join zigo.customers cu on cu.id = sr.customer_id
      left join zigo.users u on u.id = coalesce(cu.user_id, rp.customer_user_id)
      where rp.id = $1::uuid
      limit 1
    `,
    [paymentId]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "Payment not found.");
  const events = await pool.query(
    `
      select id, event_id as "eventId", event_name as "eventName",
        provider_order_id as "razorpayOrderId", provider_payment_id as "razorpayPaymentId",
        payload, processed_at as "processedAt", received_at as "receivedAt"
      from zigo.razorpay_webhook_events
      where provider_order_id = $1
         or ($2::text is not null and provider_payment_id = $2::text)
      order by received_at desc
      limit 50
    `,
    [row.razorpayOrderId, row.razorpayPaymentId || null]
  );
  return { ...row, webhookEvents: events.rows };
}

export async function listRazorpayPaymentsForBooking(bookingId: string) {
  await ensurePaymentsSchema();
  const result = await pool.query(
    `
      select id, provider_order_id as "razorpayOrderId", provider_payment_id as "razorpayPaymentId",
        amount_paise as "amountPaise", currency, status_code as status, method, bank, wallet, vpa,
        error_code as "errorCode", error_description as "errorDescription",
        captured_at as "capturedAt", verified_at as "verifiedAt",
        created_at as "createdAt", updated_at as "updatedAt", last_reconciled_at as "lastReconciledAt"
      from zigo.razorpay_payments
      where service_request_id = $1::uuid
      order by created_at desc
    `,
    [bookingId]
  );
  return result.rows;
}

export async function reconcileRazorpayPayment(paymentId: string) {
  await ensurePaymentsSchema();
  const local = await pool.query<{ id: string; orderId: string; paymentId: string | null }>(
    `select id, provider_order_id as "orderId", provider_payment_id as "paymentId" from zigo.razorpay_payments where id = $1::uuid`,
    [paymentId]
  );
  const row = local.rows[0];
  if (!row) throw new HttpError(404, "Payment not found.");
  const order = await getRazorpayClient().orders.fetch(row.orderId) as any;
  let payment: any = null;
  if (row.paymentId) payment = await getRazorpayClient().payments.fetch(row.paymentId) as any;
  if (!payment) {
    const orderPayments = await getRazorpayClient().orders.fetchPayments(row.orderId) as any;
    payment = pickBestRazorpayPayment(orderPayments?.items || []);
  }
  const statusCode = mapRazorpayStatus(payment?.status || order?.status || "pending");
  const savedPayment = await pool.query<{ statusCode: string }>(
    `
      update zigo.razorpay_payments
      set provider_payment_id = coalesce($5::text, provider_payment_id),
          status_code = case when status_code = 'paid' then 'paid' else $2 end,
          method = coalesce($6::text, method),
          bank = coalesce($7::text, bank),
          wallet = coalesce($8::text, wallet),
          vpa = coalesce($9::text, vpa),
          email = coalesce($10::text, email),
          contact = coalesce($11::text, contact),
          error_code = coalesce($12::text, error_code),
          error_description = coalesce($13::text, error_description),
          raw_order = $3::jsonb,
          raw_payment = case when $4::jsonb = '{}'::jsonb then raw_payment else $4::jsonb end,
          last_reconciled_at = now(),
          captured_at = case when $2 = 'paid' then coalesce(captured_at, now()) else captured_at end,
          updated_at = now()
      where id = $1::uuid
      returning status_code as "statusCode"
    `,
    [
      paymentId,
      statusCode,
      safeJson(order),
      safeJson(payment || {}),
      payment?.id || null,
      payment?.method || null,
      payment?.bank || null,
      payment?.wallet || null,
      payment?.vpa || null,
      payment?.email || null,
      payment?.contact || null,
      payment?.error_code || null,
      payment?.error_description || null
    ]
  );
  const effectiveStatusCode = savedPayment.rows[0]?.statusCode || statusCode;
  const booking = await updateBookingPaymentFromRazorpay(pool, row.orderId, effectiveStatusCode, {
    provider: "razorpay",
    source: "manual_reconcile",
    razorpayOrderId: row.orderId,
    razorpayPaymentId: payment?.id || row.paymentId || null,
    method: payment?.method || null
  });
  await emitPaymentRealtime(booking, "Payment reconciled");
  return { id: paymentId, status: bookingPaymentStatus(effectiveStatusCode), providerStatus: effectiveStatusCode, razorpayPaymentId: payment?.id || row.paymentId || null };
}

export async function getCustomerRazorpayOrderStatus(input: {
  customerUserId: string;
  orderId: string;
}) {
  await ensurePaymentsSchema();
  const orderId = String(input.orderId || "").trim();
  const findOrder = () => pool.query<{
    id: string;
    bookingId: string | null;
    bookingReference: string | null;
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    amountPaise: number;
    currency: string;
    statusCode: string;
    method: string | null;
    errorCode: string | null;
    errorDescription: string | null;
    lastReconciledAt: Date | null;
  }>(
    `
      select id,
        service_request_id as "bookingId",
        receipt as "bookingReference",
        provider_order_id as "razorpayOrderId",
        provider_payment_id as "razorpayPaymentId",
        amount_paise as "amountPaise",
        currency,
        status_code as "statusCode",
        method,
        error_code as "errorCode",
        error_description as "errorDescription",
        last_reconciled_at as "lastReconciledAt"
      from zigo.razorpay_payments
      where provider_order_id = $1
        and customer_user_id = $2::uuid
      limit 1
    `,
    [orderId, input.customerUserId]
  );

  let result = await findOrder();
  let row = result.rows[0];
  if (!row) throw new HttpError(404, "Payment order was not found for this customer.");

  const localStatus = bookingPaymentStatus(row.statusCode);
  const lastReconciledAt = row.lastReconciledAt ? new Date(row.lastReconciledAt).getTime() : 0;
  const shouldReconcile = ["pending", "processing"].includes(localStatus)
    && (!lastReconciledAt || Date.now() - lastReconciledAt >= 5000);
  if (shouldReconcile) {
    await reconcileRazorpayPayment(row.id);
    result = await findOrder();
    row = result.rows[0] || row;
  }

  const paymentStatus = bookingPaymentStatus(row.statusCode);
  return {
    verified: paymentStatus === "paid",
    paymentStatus,
    providerStatus: row.statusCode,
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    amountPaise: row.amountPaise,
    currency: row.currency,
    bookingId: row.bookingId,
    bookingReference: row.bookingReference,
    method: row.method,
    errorCode: row.errorCode,
    errorDescription: row.errorDescription
  };
}

export async function findCustomerPaidRazorpayPaymentByReference(input: {
  customerUserId: string;
  bookingReference: string;
  amountPaise: number;
}) {
  await ensurePaymentsSchema();
  const bookingReference = String(input.bookingReference || "").trim();
  const amountPaise = Math.round(Number(input.amountPaise || 0));
  if (!bookingReference || !Number.isFinite(amountPaise) || amountPaise < 1) return null;
  const result = await pool.query<{ orderId: string }>(
    `
      select provider_order_id as "orderId"
      from zigo.razorpay_payments
      where customer_user_id = $1::uuid
        and receipt = $2
        and amount_paise = $3::bigint
        and status_code = 'paid'
      order by updated_at desc
      limit 1
    `,
    [input.customerUserId, bookingReference, amountPaise]
  );
  const orderId = result.rows[0]?.orderId;
  return orderId
    ? getCustomerRazorpayOrderStatus({ customerUserId: input.customerUserId, orderId })
    : null;
}
