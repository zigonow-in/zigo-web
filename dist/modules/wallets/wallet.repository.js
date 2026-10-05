import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
const paise = (value) => Math.max(0, Math.round(Number(value || 0)));
async function lockWallet(db, userId) {
    await db.query("insert into zigo.customer_wallets (customer_user_id) values ($1::uuid) on conflict (customer_user_id) do nothing", [userId]);
    const result = await db.query("select available_balance_paise as \"balancePaise\", currency from zigo.customer_wallets where customer_user_id = $1::uuid for update", [userId]);
    if (!result.rows[0])
        throw new HttpError(500, "Customer wallet could not be initialized.");
    return result.rows[0];
}
export async function getCustomerWallet(userId) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        const wallet = await lockWallet(client, userId);
        await client.query("commit");
        return { availableBalancePaise: paise(wallet.balancePaise), currency: wallet.currency || "INR" };
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
    }
    finally {
        client.release();
    }
}
export async function listCustomerWalletTransactions(userId, input = {}) {
    const page = Math.max(1, Number(input.page || 1));
    const pageSize = Math.max(5, Math.min(50, Number(input.pageSize || 20)));
    const [wallet, result] = await Promise.all([getCustomerWallet(userId), pool.query(`select wt.id, wt.transaction_type as "transactionType", wt.direction, wt.amount_paise as "amountPaise",
      wt.balance_before_paise as "balanceBeforePaise", wt.balance_after_paise as "balanceAfterPaise",
      wt.currency, wt.status_code as "statusCode", wt.metadata, wt.created_at as "createdAt",
      sr.request_number as "bookingReference", ws.razorpay_order_id as "razorpayOrderId",
      ws.razorpay_payment_id as "razorpayPaymentId", count(*) over()::int as total
     from zigo.customer_wallet_transactions wt
     left join zigo.service_requests sr on sr.id = wt.service_request_id
     left join zigo.wallet_settlements ws on ws.id = wt.wallet_settlement_id
     where wt.customer_user_id = $1::uuid
     order by wt.created_at desc, wt.id desc limit $2 offset $3`, [userId, pageSize, (page - 1) * pageSize])]);
    return { wallet, data: result.rows, pagination: { page, pageSize, total: Number(result.rows[0]?.total || 0) } };
}
export async function getCustomerWalletTransaction(userId, transactionId) {
    const result = await pool.query(`select wt.id, wt.transaction_type as "transactionType", wt.direction, wt.amount_paise as "amountPaise",
      wt.balance_before_paise as "balanceBeforePaise", wt.balance_after_paise as "balanceAfterPaise",
      wt.currency, wt.status_code as "statusCode", wt.metadata, wt.created_at as "createdAt",
      sr.request_number as "bookingReference", ws.razorpay_order_id as "razorpayOrderId",
      ws.razorpay_payment_id as "razorpayPaymentId"
     from zigo.customer_wallet_transactions wt
     left join zigo.service_requests sr on sr.id = wt.service_request_id
     left join zigo.wallet_settlements ws on ws.id = wt.wallet_settlement_id
     where wt.id = $1::uuid and wt.customer_user_id = $2::uuid`, [transactionId, userId]);
    if (!result.rows[0])
        throw new HttpError(404, "Wallet transaction not found.");
    return result.rows[0];
}
export async function getBookingSettlementEligibility(bookingId) {
    const result = await pool.query(`select sr.id, sr.request_number as "bookingReference", sr.status_code as "bookingStatus",
      c.user_id as "customerUserId", sr.is_paid as "isPaid", sr.payment_status as "paymentStatus",
      coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0)::bigint as "bookingAmountPaise",
      exists(select 1 from zigo.wallet_settlements ws where ws.service_request_id = sr.id) as "alreadySettled",
      sr.accepted_assignment_id is not null as "hasAcceptedAssignment",
      exists(select 1 from zigo.task_assignments ta where (ta.service_request_id=sr.id or ta.request_id=sr.id)
        and ta.status_code in ('assigned','accepted','in_progress','completed')) as "hasAssignment",
      coalesce(rp.amount_paise,0)::bigint as "razorpayPaidAmountPaise", rp.order_id as "razorpayOrderId", rp.payment_id as "razorpayPaymentId"
     from zigo.service_requests sr join zigo.customers c on c.id=sr.customer_id
     left join lateral (select sum(amount_paise) filter(where status_code='paid') as amount_paise,
       max(provider_order_id) filter(where status_code='paid') as order_id, max(provider_payment_id) filter(where status_code='paid') as payment_id
       from zigo.razorpay_payments where service_request_id=sr.id) rp on true where sr.id=$1::uuid`, [bookingId]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(404, "Booking not found.");
    const paidAmountPaise = Math.max(paise(row.razorpayPaidAmountPaise), row.isPaid ? paise(row.bookingAmountPaise) : 0);
    const eligible = ["cancelled", "canceled"].includes(String(row.bookingStatus).toLowerCase()) && Boolean(row.isPaid || String(row.paymentStatus).toLowerCase() === "paid") && paidAmountPaise > 0 && !row.hasAcceptedAssignment && !row.hasAssignment && !row.alreadySettled;
    return { ...row, paidAmountPaise, eligible, reason: eligible ? null : row.alreadySettled ? "Already settled." : row.hasAcceptedAssignment || row.hasAssignment ? "An assigned booking cannot be settled." : "Only verified paid, cancelled, unassigned bookings can be settled." };
}
export async function settleCancelledBookingToWallet(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        const booking = await client.query("select sr.id, sr.request_number as \"bookingReference\", sr.status_code as \"bookingStatus\", sr.is_paid as \"isPaid\", sr.payment_status as \"paymentStatus\", coalesce(sr.booking_amount_paise,sr.estimated_amount_paise,0)::bigint as \"bookingAmountPaise\", sr.accepted_assignment_id as \"acceptedAssignmentId\", c.user_id as \"customerUserId\" from zigo.service_requests sr join zigo.customers c on c.id=sr.customer_id where sr.id=$1::uuid for update", [input.bookingId]);
        const row = booking.rows[0];
        if (!row)
            throw new HttpError(404, "Booking not found.");
        const assignment = await client.query("select 1 from zigo.task_assignments where (service_request_id=$1::uuid or request_id=$1::uuid) and status_code in ('assigned','accepted','in_progress','completed') limit 1", [input.bookingId]);
        const existing = await client.query("select 1 from zigo.wallet_settlements where service_request_id=$1::uuid", [input.bookingId]);
        const payment = await client.query("select coalesce(sum(amount_paise) filter(where status_code='paid'),0)::bigint as \"amountPaise\", max(provider_order_id) filter(where status_code='paid') as \"orderId\", max(provider_payment_id) filter(where status_code='paid') as \"paymentId\" from zigo.razorpay_payments where service_request_id=$1::uuid", [input.bookingId]);
        const paidAmountPaise = Math.max(paise(payment.rows[0]?.amountPaise), row.isPaid ? paise(row.bookingAmountPaise) : 0);
        if (!["cancelled", "canceled"].includes(String(row.bookingStatus).toLowerCase()) || !row.isPaid || row.acceptedAssignmentId || assignment.rows.length || existing.rows.length || !paidAmountPaise)
            throw new HttpError(409, "This booking is not eligible for wallet settlement.");
        const wallet = await lockWallet(client, row.customerUserId);
        const before = paise(wallet.balancePaise);
        const after = before + paidAmountPaise;
        const settlement = await client.query("insert into zigo.wallet_settlements(service_request_id,customer_user_id,amount_paise,currency,razorpay_order_id,razorpay_payment_id,settled_by_user_id,metadata) values($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid,$8::jsonb) returning id", [input.bookingId, row.customerUserId, paidAmountPaise, wallet.currency, payment.rows[0]?.orderId || null, payment.rows[0]?.paymentId || null, input.actorUserId, JSON.stringify({ bookingReference: row.bookingReference })]);
        await client.query("update zigo.customer_wallets set available_balance_paise=$2,updated_at=now() where customer_user_id=$1::uuid", [row.customerUserId, after]);
        const transaction = await client.query("insert into zigo.customer_wallet_transactions(customer_user_id,wallet_settlement_id,service_request_id,transaction_type,direction,amount_paise,balance_before_paise,balance_after_paise,currency,idempotency_key,reference_type,reference_id,metadata,created_by_user_id) values($1::uuid,$2::uuid,$3::uuid,'CANCELLATION_SETTLEMENT','CREDIT',$4,$5,$6,$7,$8,'booking',$3::text,$9::jsonb,$10::uuid) returning id,created_at as \"createdAt\"", [row.customerUserId, settlement.rows[0].id, input.bookingId, paidAmountPaise, before, after, wallet.currency, `settlement:${input.bookingId}`, JSON.stringify({ bookingReference: row.bookingReference, razorpayOrderId: payment.rows[0]?.orderId || null, razorpayPaymentId: payment.rows[0]?.paymentId || null }), input.actorUserId]);
        await client.query("update zigo.service_requests set metadata=coalesce(metadata,'{}'::jsonb)||$2::jsonb,updated_at=now() where id=$1::uuid", [input.bookingId, JSON.stringify({ walletSettlementId: settlement.rows[0].id, walletSettledAmountPaise: paidAmountPaise })]);
        await client.query("commit");
        return { settlementId: settlement.rows[0].id, transaction: transaction.rows[0], amountPaise: paidAmountPaise, availableBalancePaise: after, customerUserId: row.customerUserId };
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
    }
    finally {
        client.release();
    }
}
export async function debitCustomerWalletForBooking(input) {
    const amountPaise = paise(input.amountPaise);
    if (!amountPaise)
        return null;
    const client = await pool.connect();
    try {
        await client.query("begin");
        const wallet = await lockWallet(client, input.customerUserId);
        const before = paise(wallet.balancePaise);
        if (before < amountPaise)
            throw new HttpError(409, "Wallet balance changed. Please try again.");
        const after = before - amountPaise;
        await client.query("update zigo.customer_wallets set available_balance_paise=$2,updated_at=now() where customer_user_id=$1::uuid", [input.customerUserId, after]);
        const row = await client.query("insert into zigo.customer_wallet_transactions(customer_user_id,transaction_type,direction,amount_paise,balance_before_paise,balance_after_paise,currency,idempotency_key,reference_type,reference_id,metadata) values($1::uuid,'BOOKING_PAYMENT','DEBIT',$2,$3,$4,$5,$6,'booking_reference',$7,$8::jsonb) returning id", [input.customerUserId, amountPaise, before, after, wallet.currency, `booking-wallet:${input.bookingReference}`, input.bookingReference, JSON.stringify({ bookingReference: input.bookingReference, pendingBooking: true })]);
        await client.query("commit");
        return { transactionId: row.rows[0].id, amountPaise, balanceAfterPaise: after };
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
    }
    finally {
        client.release();
    }
}
export async function attachWalletDebitToBooking(input) {
    await pool.query("update zigo.customer_wallet_transactions set service_request_id=$2::uuid, reference_type='booking', reference_id=$2::text, metadata=coalesce(metadata,'{}'::jsonb)||$3::jsonb where id=$1::uuid and transaction_type='BOOKING_PAYMENT' and direction='DEBIT'", [input.transactionId, input.bookingId, JSON.stringify({ bookingReference: input.bookingReference, pendingBooking: false })]);
}
export async function reverseWalletBookingDebit(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        const debit = await client.query("select amount_paise as \"amountPaise\", status_code as \"statusCode\" from zigo.customer_wallet_transactions where id=$1::uuid and customer_user_id=$2::uuid for update", [input.debitTransactionId, input.customerUserId]);
        if (!debit.rows[0] || debit.rows[0].statusCode === "REVERSED") {
            await client.query("commit");
            return null;
        }
        const wallet = await lockWallet(client, input.customerUserId);
        const before = paise(wallet.balancePaise);
        const amount = paise(debit.rows[0].amountPaise);
        const after = before + amount;
        await client.query("update zigo.customer_wallets set available_balance_paise=$2,updated_at=now() where customer_user_id=$1::uuid", [input.customerUserId, after]);
        await client.query("update zigo.customer_wallet_transactions set status_code='REVERSED' where id=$1::uuid", [input.debitTransactionId]);
        await client.query("insert into zigo.customer_wallet_transactions(customer_user_id,transaction_type,direction,amount_paise,balance_before_paise,balance_after_paise,currency,idempotency_key,reference_type,reference_id,metadata) values($1::uuid,'REVERSAL','CREDIT',$2,$3,$4,$5,$6,'booking_reference',$7,$8::jsonb)", [input.customerUserId, amount, before, after, wallet.currency, `booking-wallet-reversal:${input.debitTransactionId}`, input.bookingReference, JSON.stringify({ reversesTransactionId: input.debitTransactionId })]);
        await client.query("commit");
        return { amountPaise: amount, balanceAfterPaise: after };
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
    }
    finally {
        client.release();
    }
}
