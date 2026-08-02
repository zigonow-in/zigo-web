import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
let razorpayClient = null;
function razorpayCredentials() {
    const keyId = env.RAZORPAY_KEY_ID?.trim();
    const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret)
        throw new HttpError(500, "Razorpay is not configured.");
    return { keyId, keySecret };
}
function getRazorpayClient() {
    const { keyId, keySecret } = razorpayCredentials();
    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }
    return razorpayClient;
}
export async function createRazorpayOrder(input) {
    const { keyId } = razorpayCredentials();
    const amount = Math.round(Number(input.amountPaise || 0));
    if (!Number.isFinite(amount) || amount < 100)
        throw new HttpError(400, "Minimum payment amount is ₹1.");
    const currency = String(input.currency || "INR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
        throw new HttpError(400, "Invalid payment currency.");
    const receipt = String(input.receipt || `zigo_${Date.now()}`).trim().slice(0, 40);
    try {
        const order = await getRazorpayClient().orders.create({
            amount,
            currency,
            receipt,
            payment_capture: true
        });
        return {
            keyId,
            orderId: order.id,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt
        };
    }
    catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        if (statusCode === 401)
            throw new HttpError(401, "Razorpay authentication failed.");
        throw new HttpError(500, "Unable to create Razorpay order.");
    }
}
export function verifyRazorpayPayment(input) {
    const { keySecret } = razorpayCredentials();
    const orderId = String(input.razorpay_order_id || "").trim();
    const paymentId = String(input.razorpay_payment_id || "").trim();
    const signature = String(input.razorpay_signature || "").trim();
    if (!orderId || !paymentId || !signature)
        throw new HttpError(400, "Missing Razorpay payment verification fields.");
    const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
        throw new HttpError(400, "Payment signature verification failed.");
    }
    return {
        verified: true,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId
    };
}
