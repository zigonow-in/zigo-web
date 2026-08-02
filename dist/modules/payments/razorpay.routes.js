import crypto from "node:crypto";
import { Router } from "express";
import Razorpay from "razorpay";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { verifyPortalToken } from "../portal/portal.repository.js";
export const razorpayRouter = Router();
const createOrderBodySchema = z.object({
    amount: z.coerce.number().int().min(100, "Minimum amount is 100 paise."),
    currency: z.string().trim().length(3).default("INR"),
    receipt: z.string().trim().min(1).max(40).optional(),
    bookingId: z.string().uuid().optional()
});
const verifyPaymentBodySchema = z.object({
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_order_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().min(1),
    bookingId: z.string().uuid().optional(),
    amount: z.coerce.number().int().min(100).optional()
});
function configuredRazorpay() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new HttpError(500, "Razorpay is not configured.");
    }
    return new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET
    });
}
function customerPortalUserId(req) {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match)
        throw new HttpError(401, "Customer authorization token required.");
    return verifyPortalToken(match[1], "customer").userId;
}
function razorpayErrorStatus(error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
    if (statusCode === 401 || statusCode === 403)
        return 401;
    return 500;
}
function safeSignatureMatch(expected, received) {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (expectedBuffer.length !== receivedBuffer.length)
        return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
razorpayRouter.post("/create-order", async (req, res, next) => {
    try {
        const userId = customerPortalUserId(req);
        const body = createOrderBodySchema.parse(req.body);
        if (body.bookingId) {
            const access = await pool.query(`select 1
           from zigo.service_requests sr
          where sr.id = $1::uuid
            and sr.customer_id in (select c.id from zigo.customers c where c.user_id = $2::uuid)
          limit 1`, [body.bookingId, userId]);
            if (!access.rowCount)
                throw new HttpError(404, "Booking not found.");
        }
        const razorpay = configuredRazorpay();
        const order = await razorpay.orders.create({
            amount: body.amount,
            currency: body.currency.toUpperCase(),
            receipt: body.receipt || `zigo_${Date.now()}`,
            notes: {
                bookingId: body.bookingId || "",
                source: "zigo_customer_portal"
            }
        });
        res.json({
            data: {
                key_id: env.RAZORPAY_KEY_ID,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency
            }
        });
    }
    catch (error) {
        if (error instanceof HttpError || error instanceof z.ZodError) {
            next(error);
            return;
        }
        next(new HttpError(razorpayErrorStatus(error), "Unable to create Razorpay order."));
    }
});
razorpayRouter.post("/verify-payment", async (req, res, next) => {
    try {
        const userId = customerPortalUserId(req);
        const body = verifyPaymentBodySchema.parse(req.body);
        if (!env.RAZORPAY_KEY_SECRET)
            throw new HttpError(500, "Razorpay is not configured.");
        const expected = crypto
            .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
            .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
            .digest("hex");
        const valid = safeSignatureMatch(expected, body.razorpay_signature);
        if (!valid)
            throw new HttpError(400, "Invalid Razorpay payment signature.");
        if (body.bookingId) {
            const paidAt = new Date();
            const metadata = {
                source: "razorpay_standard_checkout",
                paymentStatus: "paid",
                paymentType: "razorpay",
                isPaid: true,
                razorpayOrderId: body.razorpay_order_id,
                razorpayPaymentId: body.razorpay_payment_id,
                razorpaySignatureVerifiedAt: paidAt.toISOString()
            };
            const result = await pool.query(`update zigo.service_requests sr
            set payment_type = 'razorpay',
                payment_status = 'paid',
                is_paid = true,
                payment_details = coalesce(payment_details, '{}'::jsonb) || $3::jsonb,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where sr.id = $1::uuid
            and sr.customer_id in (select c.id from zigo.customers c where c.user_id = $2::uuid)
          returning sr.id`, [body.bookingId, userId, JSON.stringify(metadata)]);
            if (!result.rowCount)
                throw new HttpError(404, "Booking not found.");
        }
        res.json({
            data: {
                success: true,
                verified: true,
                bookingId: body.bookingId || null,
                razorpay_order_id: body.razorpay_order_id,
                razorpay_payment_id: body.razorpay_payment_id
            }
        });
    }
    catch (error) {
        next(error);
    }
});
