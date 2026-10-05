import { pool } from "../../db/pool.js";
import { redisCommand } from "../../infra/redis.js";
const trackingChannel = "zigo:tracking-events";
const recoverySweepMs = 30_000;
let workerTimer = null;
let workerBusy = false;
let schemaReady = null;
export function ensureTrackingOutboxSchema() {
    if (schemaReady)
        return schemaReady;
    schemaReady = pool.query(`
    create table if not exists zigo.tracking_outbox (
      id uuid primary key default gen_random_uuid(),
      event_type text not null,
      booking_id uuid references zigo.service_requests(id) on delete cascade,
      assistant_id uuid references zigo.assistants(id) on delete cascade,
      payload jsonb not null default '{}'::jsonb,
      dedupe_key text not null,
      published_at timestamptz,
      publish_attempts integer not null default 0,
      last_error text,
      created_at timestamptz not null default now()
    );
    create unique index if not exists uq_tracking_outbox_dedupe_key on zigo.tracking_outbox(dedupe_key);
    create index if not exists idx_tracking_outbox_pending on zigo.tracking_outbox(created_at) where published_at is null;
  `).then(() => undefined);
    return schemaReady;
}
export async function enqueueTrackingOutboxEvent(event) {
    await ensureTrackingOutboxSchema();
    await pool.query(`insert into zigo.tracking_outbox (event_type, booking_id, assistant_id, payload, dedupe_key)
     values ($1, $2::uuid, $3::uuid, $4::jsonb, $5)
     on conflict (dedupe_key) do nothing`, [event.type, event.bookingId, event.assistantId, JSON.stringify(event.payload), event.dedupeKey]);
    // Fast path for new pings; the recovery sweep handles Redis/network outages.
    void publishPendingTrackingEvents();
}
async function publishPendingTrackingEvents() {
    if (workerBusy)
        return;
    workerBusy = true;
    try {
        await ensureTrackingOutboxSchema();
        const pending = await pool.query(`with candidates as (
         select id
         from zigo.tracking_outbox
         where published_at is null
         order by created_at
         limit 100
         for update skip locked
       )
       update zigo.tracking_outbox outbox
       set publish_attempts = outbox.publish_attempts + 1
       from candidates
       where outbox.id = candidates.id
       returning outbox.id,
         outbox.event_type as "eventType",
         outbox.booking_id as "bookingId",
         outbox.assistant_id as "assistantId",
         outbox.payload,
         outbox.created_at as "createdAt"`);
        for (const event of pending.rows) {
            const message = JSON.stringify({
                id: event.id,
                type: event.eventType,
                bookingId: event.bookingId,
                assistantId: event.assistantId,
                payload: event.payload,
                createdAt: event.createdAt.toISOString()
            });
            const published = await redisCommand(["PUBLISH", trackingChannel, message]);
            if (published == null) {
                await pool.query("update zigo.tracking_outbox set last_error = $2 where id = $1::uuid", [event.id, "Redis publish unavailable"]);
            }
            else {
                await pool.query("update zigo.tracking_outbox set published_at = now(), last_error = null where id = $1::uuid", [event.id]);
            }
        }
    }
    finally {
        workerBusy = false;
    }
}
export function startTrackingOutboxWorker() {
    if (workerTimer)
        return;
    void publishPendingTrackingEvents();
    workerTimer = setInterval(() => void publishPendingTrackingEvents(), recoverySweepMs);
}
export function stopTrackingOutboxWorker() {
    if (workerTimer)
        clearInterval(workerTimer);
    workerTimer = null;
}
