import { EventEmitter } from "node:events";
import { pool } from "../../db/pool.js";
import { isRedisConfigured, redisCommand, redisSubscribe } from "../../infra/redis.js";

export type BookingRealtimeEvent = {
  id: string;
  type:
    | "booking.created"
    | "user.session.revoked"
    | "booking.updated"
    | "booking.assigned"
    | "booking.reassigned"
    | "booking.cancelled"
    | "booking.closed"
    | "booking.risk.changed"
    | "booking.capacity.changed"
    | "assistant.availability.changed"
    | "assistant.login.changed"
    | "assistant.cluster.changed"
    | "assistant.vehicle.changed"
    | "assistant.assignment.changed"
    | "support.ticket.created"
    | "support.ticket.updated"
    | "support.message.created";
  bookingId?: string;
  assistantId?: string;
  clusterId?: string;
  tab?: string;
  message?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

type Queryable = Pick<typeof pool, "query">;

const bookingRealtimeEmitter = new EventEmitter();
bookingRealtimeEmitter.setMaxListeners(500);
const REALTIME_CHANNEL = "zigo:booking-realtime";
const realtimeNodeId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const recentlySeenEventIds = new Set<string>();

let connectedClients = 0;
let totalEventsPublished = 0;
let lastEvent: BookingRealtimeEvent | null = null;
let schemaReadyPromise: Promise<void> | null = null;
let redisSubscriptionStarted = false;

startRedisRealtimeSubscription();

export function ensureBookingRealtimeSchema(client: Queryable = pool) {
  if (client === pool && schemaReadyPromise) return schemaReadyPromise;
  const promise = client.query(`
    create table if not exists zigo.booking_realtime_events (
      id bigserial primary key,
      event_type text not null,
      booking_id uuid,
      assistant_id uuid,
      cluster_id uuid,
      tab text,
      message text,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    alter table zigo.booking_realtime_events add column if not exists assistant_id uuid;
    alter table zigo.booking_realtime_events add column if not exists cluster_id uuid;
    create index if not exists idx_booking_realtime_events_created on zigo.booking_realtime_events(created_at desc);
    create index if not exists idx_booking_realtime_events_booking on zigo.booking_realtime_events(booking_id);
    create index if not exists idx_booking_realtime_events_assistant on zigo.booking_realtime_events(assistant_id);
    create index if not exists idx_booking_realtime_events_cluster on zigo.booking_realtime_events(cluster_id);
  `).then(() => undefined);
  if (client === pool) schemaReadyPromise = promise;
  return promise;
}

function normalizeEvent(row: {
  id: string | number;
  eventType: BookingRealtimeEvent["type"];
  bookingId: string | null;
  assistantId: string | null;
  clusterId: string | null;
  tab: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date | string;
}): BookingRealtimeEvent {
  return {
    id: String(row.id),
    type: row.eventType,
    bookingId: row.bookingId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    clusterId: row.clusterId ?? undefined,
    tab: row.tab ?? undefined,
    message: row.message ?? undefined,
    payload: row.payload ?? {},
    createdAt: new Date(row.createdAt).toISOString()
  };
}

export async function emitBookingRealtimeEvent(event: Omit<BookingRealtimeEvent, "id" | "createdAt">, client: Queryable = pool) {
  await ensureBookingRealtimeSchema(client);
  const saved = await client.query<{
    id: string;
    eventType: BookingRealtimeEvent["type"];
    bookingId: string | null;
    assistantId: string | null;
    clusterId: string | null;
    tab: string | null;
    message: string | null;
    payload: Record<string, unknown>;
    createdAt: Date;
  }>(
    `
      insert into zigo.booking_realtime_events (event_type, booking_id, assistant_id, cluster_id, tab, message, payload)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id,
        event_type as "eventType",
        booking_id as "bookingId",
        assistant_id as "assistantId",
        cluster_id as "clusterId",
        tab,
        message,
        payload,
        created_at as "createdAt"
    `,
    [event.type, event.bookingId ?? null, event.assistantId ?? null, event.clusterId ?? null, event.tab ?? null, event.message ?? null, event.payload ?? {}]
  );
  const payload = normalizeEvent(saved.rows[0]);
  broadcastBookingRealtimeEvent(payload, true);
  return payload;
}

export function emitVolatileBookingRealtimeEvent(event: Omit<BookingRealtimeEvent, "id" | "createdAt">) {
  const payload: BookingRealtimeEvent = {
    ...event,
    id: `volatile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString()
  };
  broadcastBookingRealtimeEvent(payload, true);
  return payload;
}

export async function listBookingRealtimeEventsAfter(lastEventId?: string | null, limit = 100) {
  await ensureBookingRealtimeSchema();
  const numericId = Number(lastEventId || 0);
  const result = await pool.query<{
    id: string;
    eventType: BookingRealtimeEvent["type"];
    bookingId: string | null;
    assistantId: string | null;
    clusterId: string | null;
    tab: string | null;
    message: string | null;
    payload: Record<string, unknown>;
    createdAt: Date;
  }>(
    `
      select id,
        event_type as "eventType",
        booking_id as "bookingId",
        assistant_id as "assistantId",
        cluster_id as "clusterId",
        tab,
        message,
        payload,
        created_at as "createdAt"
      from zigo.booking_realtime_events
      where id > $1
      order by id asc
      limit $2
    `,
    [Number.isFinite(numericId) && numericId > 0 ? numericId : 0, Math.max(1, Math.min(500, limit))]
  );
  return result.rows.map(normalizeEvent);
}

export function onBookingRealtimeEvent(listener: (event: BookingRealtimeEvent) => void) {
  bookingRealtimeEmitter.on("booking-event", listener);
  return () => bookingRealtimeEmitter.off("booking-event", listener);
}

export function addBookingRealtimeClient() {
  connectedClients += 1;
}

export function removeBookingRealtimeClient() {
  connectedClients = Math.max(0, connectedClients - 1);
}

export function getBookingRealtimeStats() {
  return {
    connectedClients,
    totalEventsPublished,
    lastEvent,
    redisPubSubEnabled: redisSubscriptionStarted && isRedisConfigured()
  };
}

function broadcastBookingRealtimeEvent(payload: BookingRealtimeEvent, publishToRedis: boolean) {
  if (recentlySeenEventIds.has(payload.id)) return;
  rememberEventId(payload.id);
  totalEventsPublished += 1;
  lastEvent = payload;
  bookingRealtimeEmitter.emit("booking-event", payload);
  if (publishToRedis) {
    void redisCommand([
      "PUBLISH",
      REALTIME_CHANNEL,
      JSON.stringify({ nodeId: realtimeNodeId, event: payload })
    ]).catch(() => undefined);
  }
}

function startRedisRealtimeSubscription() {
  if (redisSubscriptionStarted || !isRedisConfigured()) return;
  redisSubscriptionStarted = true;
  redisSubscribe(REALTIME_CHANNEL, (message) => {
    try {
      const parsed = JSON.parse(message) as { nodeId?: string; event?: BookingRealtimeEvent };
      if (!parsed.event || parsed.nodeId === realtimeNodeId) return;
      broadcastBookingRealtimeEvent(parsed.event, false);
    } catch {
      // Ignore malformed pub/sub payloads from other publishers.
    }
  });
}

function rememberEventId(id: string) {
  recentlySeenEventIds.add(id);
  if (recentlySeenEventIds.size <= 1000) return;
  const first = recentlySeenEventIds.values().next().value;
  if (first) recentlySeenEventIds.delete(first);
}
