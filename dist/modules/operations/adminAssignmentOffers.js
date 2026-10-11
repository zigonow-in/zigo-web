import { pool } from '../../db/pool.js';
import { HttpError } from '../../http/errors.js';
import { emitBookingRealtimeEvent } from './bookingRealtime.js';
async function finishOffer(client, offer, status) {
    const accepted = status === 'accepted';
    await client.query(`update zigo.task_assignments set status_code=$2, responded_at=now(),
    expires_at=case when $2='accepted' then coalesce(($3::jsonb->>'expectedFreeAt')::timestamptz, expires_at) else expires_at end
    where id=$1`, [offer.id, status, JSON.stringify(offer.metadata || {})]);
    await client.query(`update zigo.assistant_capacity_reservations set status_code=$2, updated_at=now()
    where assignment_id=$1 and status_code in ('held','pending','reserved','offered','confirmed','assigned','active')`, [offer.id, accepted ? 'assigned' : 'released']);
    await client.query(`update zigo.service_requests set status_code=$3,
    accepted_assignment_id=case when $3='accepted' then $2::uuid else null end,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('pendingAssignmentId',null), updated_at=now()
    where id=$1 and metadata->>'pendingAssignmentId'=$2::text and accepted_assignment_id is null`, [offer.bookingId, offer.id, accepted ? 'accepted' : 'queued']);
    await client.query(`update zigo.booking_orchestration_state set demand_status=$2,supply_status=$3,next_check_at=now(),updated_at=now()
    where service_request_id=$1 and assistant_id=$4
      and reservation_id in (select id from zigo.assistant_capacity_reservations where assignment_id=$5)`, [offer.bookingId, accepted ? 'accepted' : 'queued', accepted ? 'accepted' : 'released', offer.assistantId, offer.id]);
}
export async function respondAdminAssignmentOffer(userId, assignmentId, response) {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const result = await client.query(`select ta.id,ta.status_code as status,ta.expires_at as "expiresAt",ta.metadata,
      sr.id as "bookingId",a.id as "assistantId",sr.metadata->>'pendingAssignmentId' as "pendingAssignmentId",
      sr.accepted_assignment_id as "acceptedAssignmentId",sr.status_code as "bookingStatus"
      from zigo.task_assignments ta join zigo.assistants a on a.id=ta.assistant_id
      join zigo.service_requests sr on sr.id=coalesce(ta.service_request_id,ta.request_id)
      where ta.id=$1 and a.user_id=$2 for update of ta,sr`, [assignmentId, userId]);
        const offer = result.rows[0];
        if (!offer || !offer.metadata?.adminOffer)
            throw new HttpError(404, 'Booking offer not found.');
        if (offer.status !== 'offered' || offer.pendingAssignmentId !== offer.id || offer.acceptedAssignmentId || ['completed', 'success', 'done', 'cancelled', 'canceled', 'rejected', 'failed', 'expired'].includes(offer.bookingStatus))
            throw new HttpError(409, 'This booking offer is no longer available.');
        const status = new Date(offer.expiresAt).getTime() <= Date.now() ? 'expired' : response;
        await finishOffer(client, offer, status);
        await client.query('commit');
        return { assignmentId: offer.id, bookingId: offer.bookingId, assistantId: offer.assistantId, status };
    }
    catch (error) {
        await client.query('rollback');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function expireAdminAssignmentOffers() {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const result = await client.query(`select ta.id,ta.metadata,sr.id as "bookingId",ta.assistant_id as "assistantId"
      from zigo.task_assignments ta join zigo.service_requests sr on sr.id=coalesce(ta.service_request_id,ta.request_id)
      where ta.status_code='offered' and ta.metadata->>'adminOffer'='true' and ta.expires_at<=now()
      order by ta.expires_at limit 100 for update of ta,sr skip locked`);
        for (const offer of result.rows)
            await finishOffer(client, offer, 'expired');
        await client.query('commit');
        return result.rows;
    }
    catch (error) {
        await client.query('rollback');
        throw error;
    }
    finally {
        client.release();
    }
}
let timer = null;
let busy = false;
let indexed = false;
export function startAdminAssignmentOfferWorker() {
    if (timer)
        return;
    const run = async () => {
        if (busy)
            return;
        busy = true;
        try {
            if (!indexed) {
                await pool.query(`create index if not exists idx_admin_assignment_offer_expiry on zigo.task_assignments(expires_at)
          where status_code='offered' and metadata->>'adminOffer'='true'`);
                indexed = true;
            }
            const expired = await expireAdminAssignmentOffers();
            for (const offer of expired)
                await emitBookingRealtimeEvent({ type: 'booking.updated', bookingId: offer.bookingId, assistantId: offer.assistantId,
                    message: 'Booking offer expired', payload: { assignmentId: offer.id, assignmentStatus: 'expired' } });
        }
        catch (error) {
            console.error('Admin booking offer expiration failed', error);
        }
        finally {
            busy = false;
        }
    };
    timer = setInterval(run, 2000);
    timer.unref();
    void run();
}
export function stopAdminAssignmentOfferWorker() { if (timer)
    clearInterval(timer); timer = null; }
