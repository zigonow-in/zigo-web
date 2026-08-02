import { pool } from "../../db/pool.js";
import { sendTransactionalEmail } from "../users/users.repository.js";

type JsonRecord = Record<string, unknown>;

type InvoiceBookingRow = {
  id: string;
  requestNumber: string;
  bookingAt: Date;
  bookingType: string;
  bookingStartAt: Date | null;
  bookingEndAt: Date | null;
  durationMinutes: number;
  paymentStatus: string | null;
  paymentType: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceDetails: JsonRecord | null;
  categoryDetails: JsonRecord | null;
  metadata: JsonRecord | null;
  locationDetails: unknown;
  basePricePaise: number;
  discountPaise: number;
  sellingPricePaise: number;
  itemTotalPaise: number;
  taxAmountPaise: number;
  tipAmountPaise: number;
  waitingChargesPaise: number;
  grandTotalPaise: number;
  taxDetails: unknown;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(paise: unknown) {
  const amount = Number(paise || 0) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
}

function indiaDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(value);
}

function durationLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (!hours) return `${remainder} min`;
  return `${hours} hr${hours === 1 ? "" : "s"}${remainder ? ` ${remainder} min` : ""}`;
}

function taxRows(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map(record)
    .map((row) => ({
      label: text(row.taxLabel || row.label || row.name, "Tax"),
      amountPaise: Math.max(0, Math.round(Number(row.taxAmountPaise || row.amountPaise || 0)))
    }))
    .filter((row) => row.amountPaise > 0);
}

function locationAddress(value: unknown) {
  const locations = Array.isArray(value) ? value.map(record) : [record(value)];
  const first = locations.find((location) => Object.keys(location).length > 0) || {};
  return text(first.address || first.addressText || first.formattedAddress || first.detail || first.label, "-");
}

function timeRange(startAt: Date | null, endAt: Date | null) {
  if (!startAt) return "-";
  const time = (value: Date) => new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(value);
  return `${time(startAt)} - ${endAt ? time(endAt) : "-"}`;
}

function stripTags(value: unknown) {
  return text(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function invoiceCategoryMasterName(booking: InvoiceBookingRow) {
  const metadata = record(booking.metadata);
  const service = record(booking.serviceDetails);
  const category = record(booking.categoryDetails);
  const categoryBooking = record(metadata.categoryBooking);
  const cartItems = Array.isArray(metadata.cartItems) ? metadata.cartItems.map(record) : [];
  const first = cartItems[0] || categoryBooking;
  const mode = text(first.homeDisplayMode || categoryBooking.homeDisplayMode || metadata.homeDisplayMode || category.homeDisplayMode, "").toLowerCase();
  const serviceMasterName = stripTags(first.serviceMasterName || categoryBooking.serviceMasterName || metadata.serviceMasterName || service.serviceMasterName || service.name || service.serviceName);
  const categoryName = stripTags(first.categoryName || first.name || categoryBooking.categoryName || metadata.categoryName || category.name || category.categoryName);
  if (mode.includes("price")) return categoryName || serviceMasterName || "ZIGO Assistance";
  return [serviceMasterName, categoryName].filter(Boolean).join(" ") || categoryName || serviceMasterName || "ZIGO Assistance";
}

function invoiceHtml(booking: InvoiceBookingRow) {
  const serviceDisplayName = invoiceCategoryMasterName(booking);
  const taxes = taxRows(booking.taxDetails);
  const address = locationAddress(booking.locationDetails);
  const itemTotal = booking.itemTotalPaise || booking.sellingPricePaise;
  const paymentLabel = text(booking.paymentStatus, "Due");
  const summaryRows = [
    ["Item total", money(itemTotal)],
    ...taxes.map((tax) => [tax.label, money(tax.amountPaise)]),
    ...(!taxes.length && booking.taxAmountPaise > 0 ? [["Tax", money(booking.taxAmountPaise)]] : []),
    ...(booking.tipAmountPaise > 0 ? [["Tip", money(booking.tipAmountPaise)]] : []),
    ...(booking.waitingChargesPaise > 0 ? [["Waiting charges", money(booking.waitingChargesPaise)]] : [])
  ];
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    @media only screen and (max-width:620px) {
      .invoice-shell { width:100% !important; }
      .invoice-pad { padding-left:18px !important; padding-right:18px !important; }
      .invoice-column { display:block !important; width:100% !important; box-sizing:border-box !important; }
      .invoice-column-spacer { display:none !important; }
      .invoice-company { text-align:left !important; padding-top:14px !important; }
      .invoice-service-table { font-size:12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef3fa;font-family:Arial,Helvetica,sans-serif;color:#101a33;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ZIGO booking ${escapeHtml(booking.requestNumber)} is confirmed.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef3fa;padding:24px 10px;">
    <tr><td align="center">
      <table class="invoice-shell" role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid #dbe4f1;border-radius:12px;overflow:hidden;">
        <tr>
          <td class="invoice-pad" style="padding:24px 28px;background:#0966e8;color:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="invoice-column" width="44%" valign="top">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr><td style="background:#ffffff;border-radius:8px;padding:8px 12px;">
                      <img src="https://zigonow.in/admin/assets/zigo-logo-original.svg.png" width="116" alt="ZIGO" style="display:block;width:116px;max-width:100%;height:auto;border:0;">
                    </td></tr>
                  </table>
                  <div style="font-size:12px;line-height:1.45;margin-top:12px;color:#dceaff;">Personal assistance, when you need it.</div>
                </td>
                <td class="invoice-column invoice-company" width="56%" valign="top" align="right">
                  <div style="font-size:22px;font-weight:800;letter-spacing:0;color:#ffffff;">TAX INVOICE</div>
                  <div style="font-size:13px;font-weight:700;margin-top:8px;color:#ffffff;">ZIGO Logistics Private Limited</div>
                  <div style="font-size:11px;line-height:1.5;margin-top:5px;color:#dceaff;">GSTIN: 06AACCZ8504H1Z8<br>CIN: U52101HR2025PTC139847</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td class="invoice-pad" style="padding:24px 28px 12px;">
          <div style="font-size:16px;font-weight:700;color:#101a33;">Hello ${escapeHtml(booking.customerName || "Customer")},</div>
          <div style="font-size:13px;line-height:1.6;color:#60708a;margin-top:6px;">Thank you for choosing ZIGO. Your booking has been confirmed and the invoice details are provided below.</div>
        </td></tr>
        <tr><td class="invoice-pad" style="padding:10px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td class="invoice-column" width="49%" valign="top" style="border:1px solid #dfe7f2;border-radius:8px;padding:15px;box-sizing:border-box;">
                <div style="font-size:10px;font-weight:800;color:#0966e8;text-transform:uppercase;letter-spacing:.7px;">Bill To</div>
                <div style="font-size:14px;font-weight:700;margin-top:10px;color:#101a33;">${escapeHtml(booking.customerName || "Customer")}</div>
                <div style="font-size:12px;line-height:1.55;color:#60708a;margin-top:4px;">${escapeHtml(booking.customerEmail || "-")}<br>${escapeHtml(booking.customerPhone || "-")}<br>${escapeHtml(address)}</div>
              </td>
              <td class="invoice-column-spacer" width="2%">&nbsp;</td>
              <td class="invoice-column" width="49%" valign="top" style="border:1px solid #dfe7f2;border-radius:8px;padding:15px;box-sizing:border-box;">
                <div style="font-size:10px;font-weight:800;color:#0966e8;text-transform:uppercase;letter-spacing:.7px;">Order Details</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="3" border="0" style="font-size:12px;margin-top:6px;">
                  <tr><td style="color:#718097;">Invoice No.</td><td align="right" style="font-weight:700;color:#101a33;">${escapeHtml(booking.requestNumber)}</td></tr>
                  <tr><td style="color:#718097;">Invoice Date</td><td align="right">${escapeHtml(indiaDateTime(booking.bookingAt))}</td></tr>
                  <tr><td style="color:#718097;">Booking Type</td><td align="right" style="text-transform:capitalize;">${escapeHtml(booking.bookingType)}</td></tr>
                  <tr><td style="color:#718097;">Service Time</td><td align="right">${escapeHtml(timeRange(booking.bookingStartAt, booking.bookingEndAt))}</td></tr>
                  <tr><td style="color:#718097;">Payment</td><td align="right" style="font-weight:700;text-transform:capitalize;color:${paymentLabel.toLowerCase() === "paid" ? "#16834b" : "#a66a00"};">${escapeHtml(paymentLabel)}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="invoice-pad" style="padding:14px 28px 8px;">
          <div style="font-size:11px;font-weight:800;color:#0966e8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px;">Service Details</div>
          <table class="invoice-service-table" role="presentation" width="100%" cellspacing="0" cellpadding="9" border="0" style="font-size:13px;border-collapse:collapse;border:1px solid #dfe7f2;">
            <tr style="background:#edf5ff;color:#24405f;">
              <th align="left" style="border-bottom:1px solid #dfe7f2;">Service / Category</th>
              <th align="center" style="border-bottom:1px solid #dfe7f2;">Duration</th>
              <th align="right" style="border-bottom:1px solid #dfe7f2;">Base Price</th>
              <th align="right" style="border-bottom:1px solid #dfe7f2;">Discount</th>
              <th align="right" style="border-bottom:1px solid #dfe7f2;">Amount</th>
            </tr>
            <tr>
              <td><strong>${escapeHtml(serviceDisplayName)}</strong></td>
              <td align="center">${escapeHtml(durationLabel(booking.durationMinutes))}</td>
              <td align="right">${escapeHtml(money(booking.basePricePaise))}</td>
              <td align="right" style="color:#16834b;">${booking.discountPaise > 0 ? `- ${escapeHtml(money(booking.discountPaise))}` : "-"}</td>
              <td align="right" style="font-weight:700;">${escapeHtml(money(itemTotal))}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="invoice-pad" style="padding:14px 28px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td class="invoice-column" width="53%" valign="top" style="padding:15px;background:#f7f9fc;border-radius:8px;box-sizing:border-box;">
                <div style="font-size:10px;font-weight:800;color:#0966e8;text-transform:uppercase;letter-spacing:.7px;">Service Address</div>
                <div style="font-size:12px;line-height:1.6;color:#52627a;margin-top:8px;">${escapeHtml(address)}</div>
                <div style="font-size:11px;line-height:1.5;color:#718097;margin-top:12px;">Scheduled: ${escapeHtml(indiaDateTime(booking.bookingStartAt))}<br>Payment mode: ${escapeHtml(booking.paymentType || "-")}</div>
              </td>
              <td class="invoice-column-spacer" width="3%">&nbsp;</td>
              <td class="invoice-column" width="44%" valign="top" style="border:1px solid #dfe7f2;border-radius:8px;padding:12px 15px;box-sizing:border-box;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="5" border="0" style="font-size:12px;">
                  ${summaryRows.map(([label, amount]) => `<tr><td style="color:#68758a;">${escapeHtml(label)}</td><td align="right">${escapeHtml(amount)}</td></tr>`).join("")}
                  <tr><td style="border-top:1px solid #dfe7f2;padding-top:10px;font-size:16px;font-weight:800;color:#101a33;">Total</td><td align="right" style="border-top:1px solid #dfe7f2;padding-top:10px;font-size:16px;font-weight:800;color:#0966e8;">${escapeHtml(money(booking.grandTotalPaise))}</td></tr>
                </table>
              </td>
            </tr>
          </table>
          <div style="font-size:11px;line-height:1.55;color:#718097;margin-top:16px;">This invoice reflects the pricing saved when the booking was confirmed. Payment status may be updated after payment collection or online payment confirmation.</div>
        </td></tr>
        <tr><td class="invoice-pad" style="padding:20px 28px;background:#0b1d3a;color:#d8e3f3;">
          <div style="font-size:13px;font-weight:700;color:#ffffff;">ZIGO Logistics Private Limited</div>
          <div style="font-size:11px;line-height:1.65;margin-top:7px;">204, 2ND FLOOR, PL TOWER, SIKANDERPUR, GURUGRAM, Narsinghpur, Narsinghpur, Gurgaon - 122004, Haryana</div>
          <div style="font-size:11px;line-height:1.65;margin-top:7px;">State: Haryana &nbsp;|&nbsp; City: Gurgaon &nbsp;|&nbsp; Pin code: 122004</div>
          <div style="font-size:11px;line-height:1.65;margin-top:7px;">GSTIN: 06AACCZ8504H1Z8 &nbsp;|&nbsp; CIN: U52101HR2025PTC139847</div>
          <div style="font-size:11px;line-height:1.65;margin-top:7px;"><a href="mailto:admin@zigonow.in" style="color:#9ec8ff;text-decoration:none;">admin@zigonow.in</a> &nbsp;|&nbsp; 8448736661, 8448736662 &nbsp;|&nbsp; <a href="https://zigonow.in" style="color:#9ec8ff;text-decoration:none;">zigonow.in</a></div>
        </td></tr>
        <tr><td style="padding:12px 28px;background:#07152c;color:#91a3bd;font-size:10px;text-align:center;">This is a computer-generated invoice and does not require a signature.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function saveDeliveryState(bookingId: string, state: JsonRecord) {
  await pool.query(
    `
      update zigo.service_requests
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('invoiceEmail', $2::jsonb),
          updated_at = now()
      where id = $1::uuid
    `,
    [bookingId, JSON.stringify(state)]
  );
}

export async function sendCustomerBookingInvoice(bookingId: string, customerUserId: string) {
  const result = await pool.query<InvoiceBookingRow>(
    `
      select
        sr.id,
        sr.request_number as "requestNumber",
        sr.booking_at as "bookingAt",
        sr.booking_type as "bookingType",
        sr.booking_start_at as "bookingStartAt",
        sr.booking_end_at as "bookingEndAt",
        coalesce(sr.duration_minutes, 0)::int as "durationMinutes",
        sr.payment_status as "paymentStatus",
        sr.payment_type as "paymentType",
        coalesce(nullif(u.display_name, ''), nullif(sr.customer_details->>'name', ''), 'Customer') as "customerName",
        u.email as "customerEmail",
        u.phone as "customerPhone",
        sr.service_details as "serviceDetails",
        sr.category_details as "categoryDetails",
        coalesce(sr.metadata, '{}'::jsonb) as "metadata",
        sr.location_details as "locationDetails",
        coalesce(bbs.base_price_paise, sr.base_price_paise, 0)::int as "basePricePaise",
        coalesce(bbs.discount_paise, sr.discount_paise, 0)::int as "discountPaise",
        coalesce(bbs.selling_price_paise, sr.selling_price_paise, 0)::int as "sellingPricePaise",
        coalesce(bbs.item_total_paise, sr.selling_price_paise, 0)::int as "itemTotalPaise",
        coalesce(bbs.tax_amount_paise, 0)::int as "taxAmountPaise",
        coalesce(bbs.tip_amount_paise, 0)::int as "tipAmountPaise",
        coalesce(bbs.waiting_charges_paise, sr.waiting_charges_paise, 0)::int as "waitingChargesPaise",
        coalesce(bbs.grand_total_paise, sr.booking_amount_paise, sr.estimated_amount_paise, 0)::int as "grandTotalPaise",
        coalesce(bbs.tax_details, '[]'::jsonb) as "taxDetails"
      from zigo.service_requests sr
      join zigo.customers c on c.id = sr.customer_id and c.user_id = $2::uuid
      join zigo.users u on u.id = c.user_id and u.deleted_at is null
      left join zigo.booking_billing_snapshots bbs on bbs.service_request_id = sr.id
      where sr.id = $1::uuid
      limit 1
    `,
    [bookingId, customerUserId]
  );
  const booking = result.rows[0];
  if (!booking) return { status: "skipped", reason: "Booking or customer was not found." };
  if (!booking.customerEmail) {
    const state = { status: "skipped", reason: "Customer email is not registered.", attemptedAt: new Date().toISOString() };
    await saveDeliveryState(booking.id, state);
    return state;
  }
  try {
    const delivery = await sendTransactionalEmail({
      to: booking.customerEmail,
      subject: `ZIGO Invoice - Booking ${booking.requestNumber}`,
      html: invoiceHtml(booking),
      fromName: "ZIGO"
    });
    const state = {
      status: "status" in delivery ? delivery.status : "skipped",
      email: booking.customerEmail,
      from: "from" in delivery ? delivery.from : null,
      sentAt: "status" in delivery && delivery.status === "sent" ? new Date().toISOString() : null,
      reason: "reason" in delivery ? delivery.reason : null
    };
    await saveDeliveryState(booking.id, state);
    return state;
  } catch (error) {
    const state = {
      status: "failed",
      email: booking.customerEmail,
      attemptedAt: new Date().toISOString(),
      reason: error instanceof Error ? error.message : "Unable to send booking invoice."
    };
    await saveDeliveryState(booking.id, state).catch(() => undefined);
    console.error("Unable to send customer booking invoice", { bookingId, customerUserId, error });
    return state;
  }
}

type BookingInvoiceEmailJob = {
  id: string;
  bookingId: string;
  customerUserId: string;
  attemptCount: number;
};

export async function enqueueCustomerBookingInvoice(bookingId: string, customerUserId: string) {
  const result = await pool.query(
    `insert into zigo.booking_invoice_email_jobs
       (booking_id, customer_user_id, status, next_attempt_at, updated_at)
     values ($1::uuid, $2::uuid, 'pending', now(), now())
     on conflict (booking_id) do update
       set customer_user_id = excluded.customer_user_id,
           status = case
             when zigo.booking_invoice_email_jobs.status in ('sent', 'skipped') then zigo.booking_invoice_email_jobs.status
             else 'pending'
           end,
           next_attempt_at = case
             when zigo.booking_invoice_email_jobs.status in ('sent', 'skipped') then zigo.booking_invoice_email_jobs.next_attempt_at
             else now()
           end,
           locked_at = null,
           updated_at = now()
     returning status`,
    [bookingId, customerUserId]
  );
  return { status: String(result.rows[0]?.status || "pending") };
}

async function claimCustomerBookingInvoiceJobs(batchSize: number) {
  const result = await pool.query<BookingInvoiceEmailJob>(
    `with due_jobs as (
       select id
       from zigo.booking_invoice_email_jobs
       where (
         status in ('pending', 'retry') and next_attempt_at <= now()
       ) or (
         status = 'processing' and locked_at <= now() - interval '15 minutes'
       )
       order by next_attempt_at, id
       for update skip locked
       limit $1
     )
     update zigo.booking_invoice_email_jobs jobs
     set status = 'processing',
         attempt_count = jobs.attempt_count + 1,
         locked_at = now(),
         updated_at = now()
     from due_jobs
     where jobs.id = due_jobs.id
     returning jobs.id::text as id,
       jobs.booking_id as "bookingId",
       jobs.customer_user_id as "customerUserId",
       jobs.attempt_count as "attemptCount"`,
    [Math.max(1, Math.min(25, batchSize))]
  );
  return result.rows;
}

function invoiceRetryDelaySeconds(attemptCount: number) {
  return [60, 300, 900, 3600, 10_800][Math.max(0, Math.min(4, attemptCount - 1))];
}

export async function processCustomerBookingInvoiceQueue(batchSize = 5) {
  const jobs = await claimCustomerBookingInvoiceJobs(batchSize);
  for (const job of jobs) {
    try {
      const delivery = await sendCustomerBookingInvoice(job.bookingId, job.customerUserId);
      const deliveryStatus = String(delivery.status || "failed");
      const reason = "reason" in delivery ? String(delivery.reason || "") : "";
      const providerUnavailable = deliveryStatus === "skipped" && /provider is not configured/i.test(reason);
      if (deliveryStatus === "sent" || (deliveryStatus === "skipped" && !providerUnavailable)) {
        await pool.query(
          `update zigo.booking_invoice_email_jobs
           set status = $2,
               sent_at = case when $2 = 'sent' then now() else sent_at end,
               locked_at = null,
               last_error = nullif($3, ''),
               updated_at = now()
           where id = $1::bigint`,
          [job.id, deliveryStatus, reason]
        );
        continue;
      }
      throw new Error(reason || "Invoice email delivery failed.");
    } catch (error) {
      const terminal = job.attemptCount >= 5;
      const reason = error instanceof Error ? error.message : String(error || "Invoice email delivery failed.");
      await pool.query(
        `update zigo.booking_invoice_email_jobs
         set status = $2,
             next_attempt_at = now() + ($3::int * interval '1 second'),
             locked_at = null,
             last_error = $4,
             updated_at = now()
         where id = $1::bigint`,
        [job.id, terminal ? "failed" : "retry", invoiceRetryDelaySeconds(job.attemptCount), reason.slice(0, 2000)]
      );
    }
  }
  return jobs.length;
}

export async function getNextCustomerBookingInvoiceDueAt() {
  const result = await pool.query<{ dueAt: Date | null }>(
    `select min(
       case
         when status = 'processing' then locked_at + interval '15 minutes'
         else next_attempt_at
       end
     ) as "dueAt"
     from zigo.booking_invoice_email_jobs
     where status in ('pending', 'retry', 'processing')`
  );
  return result.rows[0]?.dueAt || null;
}
