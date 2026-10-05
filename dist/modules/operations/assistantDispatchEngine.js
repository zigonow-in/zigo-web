import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { redisCommand } from "../../infra/redis.js";
import { requestOlaJson } from "../maps/olaMaps.service.js";
let dispatchSchemaReady = null;
export function normalizePresenceStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "ONLINE" || normalized === "OFFLINE" || normalized === "STALE")
        return normalized;
    return "OFFLINE";
}
export function normalizeWorkStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (["FREE", "HELD", "ASSIGNED", "TRAVELLING", "WORKING", "WRAP_UP", "BREAK"].includes(normalized))
        return normalized;
    return "FREE";
}
export function normalizeAvailabilityConfidence(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "CONFIRMED" || normalized === "EXPECTED" || normalized === "UNKNOWN")
        return normalized;
    return "UNKNOWN";
}
export function dispatchConfigFromEnv() {
    return {
        arrivalBufferMinutes: envNumber("DISPATCH_ARRIVAL_BUFFER_MINUTES", 2),
        wrapUpBufferMinutes: envNumber("DISPATCH_WRAP_UP_BUFFER_MINUTES", 5),
        gpsFreshnessSeconds: envNumber("DISPATCH_GPS_FRESHNESS_SECONDS", 120),
        heartbeatTimeoutSeconds: envNumber("DISPATCH_HEARTBEAT_TIMEOUT_SECONDS", 90),
        travelMultiplier: envNumber("DISPATCH_TRAVEL_MULTIPLIER", 1.2),
        holdDurationSeconds: envNumber("DISPATCH_HOLD_DURATION_SECONDS", 90),
        sameClusterNearRadiusMeters: envNumber("DISPATCH_SAME_CLUSTER_NEAR_RADIUS_METERS", 2000),
        sameClusterFarRadiusMeters: envNumber("DISPATCH_SAME_CLUSTER_FAR_RADIUS_METERS", 4000),
        instantPromiseMinutes: envNumber("DISPATCH_INSTANT_PROMISE_MINUTES", 10)
    };
}
export function ensureAssistantDispatchSchema(client = pool) {
    if (client === pool && dispatchSchemaReady)
        return dispatchSchemaReady;
    const ready = client.query(`
    create extension if not exists btree_gist;

    alter table if exists zigo.assistant_availability
      add column if not exists presence_status text not null default 'OFFLINE',
      add column if not exists work_status text not null default 'FREE',
      add column if not exists availability_confidence text not null default 'UNKNOWN',
      add column if not exists heartbeat_at timestamptz,
      add column if not exists gps_captured_at timestamptz,
      add column if not exists next_available_at timestamptz,
      add column if not exists next_available_lat numeric(10,7),
      add column if not exists next_available_lng numeric(10,7),
      add column if not exists next_available_cluster_id uuid references zigo.clusters(id) on delete set null,
      add column if not exists status_updated_at timestamptz not null default now();

    create table if not exists zigo.assistant_calendar_blocks (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      block_type text not null,
      status_code text not null default 'active',
      source_type text,
      source_id uuid,
      cluster_id uuid references zigo.clusters(id) on delete set null,
      start_at timestamptz not null,
      end_at timestamptz not null,
      start_lat numeric(10,7),
      start_lng numeric(10,7),
      end_lat numeric(10,7),
      end_lng numeric(10,7),
      confidence text not null default 'EXPECTED',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (end_at > start_at),
      check (block_type in ('SHIFT', 'BOOKING', 'TEMPORARY_HOLD', 'TRAVEL', 'WRAP_UP', 'BREAK', 'TIME_OFF', 'ADMIN_BLOCK')),
      check (confidence in ('CONFIRMED', 'EXPECTED', 'UNKNOWN'))
    );

    create index if not exists idx_assistant_calendar_blocks_assistant_window
      on zigo.assistant_calendar_blocks (assistant_id, start_at, end_at)
      where status_code = 'active';
    create index if not exists idx_assistant_calendar_blocks_source
      on zigo.assistant_calendar_blocks (source_type, source_id)
      where source_id is not null;
    create index if not exists idx_assistant_calendar_blocks_cluster_window
      on zigo.assistant_calendar_blocks (cluster_id, start_at, end_at)
      where status_code = 'active';

    do $$
    begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'assistant_calendar_blocks_no_overlap'
          and conrelid = 'zigo.assistant_calendar_blocks'::regclass
      ) then
        alter table zigo.assistant_calendar_blocks
          add constraint assistant_calendar_blocks_no_overlap
          exclude using gist (
            assistant_id with =,
            tstzrange(start_at, end_at, '[)') with &&
          )
          where (
            status_code = 'active'
            and block_type in ('BOOKING', 'TEMPORARY_HOLD', 'TRAVEL', 'WRAP_UP', 'BREAK', 'TIME_OFF', 'ADMIN_BLOCK')
          );
      end if;
    end $$;
  `).then(() => undefined);
    if (client === pool)
        dispatchSchemaReady = ready;
    return ready;
}
export async function goAssistantOnline(input) {
    await ensureAssistantDispatchSchema();
    const point = parseCoordinate(input.location);
    if (!point)
        throw new HttpError(400, "Current GPS location is required to go online.");
    const capturedAt = input.location.capturedAt ? new Date(input.location.capturedAt) : new Date();
    await pool.query(`
      insert into zigo.assistant_availability
        (assistant_id, status_code, presence_status, work_status, availability_confidence,
         latitude, longitude, heartbeat_at, gps_captured_at, online_started_at, updated_at, status_updated_at)
      values ($1::uuid, 'available', 'ONLINE', 'FREE', 'CONFIRMED', $2, $3, now(), $4, now(), now(), now())
      on conflict (assistant_id)
      do update set
        status_code = 'available',
        presence_status = 'ONLINE',
        work_status = case when zigo.assistant_availability.work_status in ('WORKING', 'ASSIGNED', 'TRAVELLING', 'WRAP_UP', 'HELD')
          then zigo.assistant_availability.work_status else 'FREE' end,
        availability_confidence = 'CONFIRMED',
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        heartbeat_at = now(),
        gps_captured_at = excluded.gps_captured_at,
        online_started_at = coalesce(zigo.assistant_availability.online_started_at, now()),
        updated_at = now(),
        status_updated_at = now()
    `, [input.assistantId, point.latitude, point.longitude, validDate(capturedAt) ?? new Date()]);
    await writePresenceCache(input.assistantId, "ONLINE", point);
    return refreshAssistantAvailabilityCache(input.assistantId);
}
export async function goAssistantOffline(input) {
    await ensureAssistantDispatchSchema();
    await pool.query(`
      insert into zigo.assistant_availability
        (assistant_id, status_code, presence_status, work_status, availability_confidence, updated_at, status_updated_at)
      values ($1::uuid, 'offline', 'OFFLINE', 'FREE', 'UNKNOWN', now(), now())
      on conflict (assistant_id)
      do update set
        status_code = 'offline',
        presence_status = 'OFFLINE',
        work_status = case when zigo.assistant_availability.work_status in ('WORKING', 'ASSIGNED', 'TRAVELLING', 'WRAP_UP', 'HELD')
          then zigo.assistant_availability.work_status else 'FREE' end,
        availability_confidence = 'UNKNOWN',
        online_started_at = null,
        updated_at = now(),
        status_updated_at = now()
    `, [input.assistantId]);
    await redisCommand(["DEL", assistantPresenceKey(input.assistantId)]).catch(() => null);
    return refreshAssistantAvailabilityCache(input.assistantId);
}
export async function recordAssistantHeartbeat(input) {
    await ensureAssistantDispatchSchema();
    const point = parseCoordinate(input.location ?? {});
    await pool.query(`
      update zigo.assistant_availability
      set presence_status = 'ONLINE',
          heartbeat_at = now(),
          latitude = coalesce($2, latitude),
          longitude = coalesce($3, longitude),
          gps_captured_at = case when $2 is null or $3 is null then gps_captured_at else now() end,
          updated_at = now(),
          status_updated_at = now()
      where assistant_id = $1::uuid
    `, [input.assistantId, point?.latitude ?? null, point?.longitude ?? null]);
    await writePresenceCache(input.assistantId, "ONLINE", point ?? undefined);
    return refreshAssistantAvailabilityCache(input.assistantId);
}
export async function recordAssistantLocationUpdate(input) {
    await ensureAssistantDispatchSchema();
    const point = parseCoordinate(input.location);
    if (!point)
        throw new HttpError(400, "Latitude and longitude are required.");
    const capturedAt = validDate(input.location.capturedAt) ?? new Date();
    await pool.query(`
      insert into zigo.assistant_location_pings
        (assistant_id, request_id, service_request_id, latitude, longitude, accuracy_meters, captured_at, metadata)
      values ($1::uuid, $2::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)
    `, [
        input.assistantId,
        input.bookingId ?? null,
        point.latitude,
        point.longitude,
        numberOrNull(input.location.accuracy),
        capturedAt,
        JSON.stringify({ source: "dispatch_engine", assignmentId: input.assignmentId ?? null })
    ]);
    await pool.query(`
      update zigo.assistant_availability
      set latitude = $2,
          longitude = $3,
          gps_captured_at = $4,
          heartbeat_at = coalesce(heartbeat_at, now()),
          presence_status = case when presence_status = 'OFFLINE' then 'ONLINE' else presence_status end,
          updated_at = now(),
          status_updated_at = now()
      where assistant_id = $1::uuid
    `, [input.assistantId, point.latitude, point.longitude, capturedAt]);
    await writePresenceCache(input.assistantId, "ONLINE", point);
    return refreshAssistantAvailabilityCache(input.assistantId);
}
export async function createTemporaryHold(input) {
    await ensureAssistantDispatchSchema();
    const config = dispatchConfigFromEnv();
    const endAt = input.endAt ?? new Date(input.startAt.getTime() + config.holdDurationSeconds * 1000);
    const client = await pool.connect();
    try {
        await client.query("begin");
        const result = await client.query(`
        insert into zigo.assistant_calendar_blocks
          (assistant_id, block_type, source_type, source_id, cluster_id, start_at, end_at, confidence, metadata)
        values ($1::uuid, 'TEMPORARY_HOLD', $2, $3::uuid, $4::uuid, $5, $6, 'EXPECTED', $7::jsonb)
        returning id
      `, [input.assistantId, input.sourceType ?? "booking_hold", input.sourceId ?? null, input.clusterId, input.startAt, endAt, JSON.stringify(input.metadata ?? {})]);
        await refreshAssistantAvailabilityCache(input.assistantId, client);
        await client.query("commit");
        return { id: result.rows[0].id, assistantId: input.assistantId, startAt: input.startAt, endAt };
    }
    catch (error) {
        await client.query("rollback");
        if (isExclusionConflict(error))
            throw new HttpError(409, "Assistant is no longer available for this time window.");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function releaseTemporaryHold(input) {
    await ensureAssistantDispatchSchema();
    const result = await pool.query(`
      update zigo.assistant_calendar_blocks
      set status_code = 'released',
          metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
          updated_at = now()
      where block_type = 'TEMPORARY_HOLD'
        and status_code = 'active'
        and ($1::uuid is null or id = $1::uuid)
        and ($2::uuid is null or source_id = $2::uuid)
        and ($3::uuid is null or assistant_id = $3::uuid)
      returning assistant_id as "assistantId"
    `, [input.holdId ?? null, input.sourceId ?? null, input.assistantId ?? null, JSON.stringify({ releaseReason: input.reason ?? "released" })]);
    await Promise.all(result.rows.map((row) => refreshAssistantAvailabilityCache(row.assistantId)));
    return { released: result.rowCount ?? 0 };
}
export async function assignAssistantWithCalendarBlock(input) {
    await ensureAssistantDispatchSchema();
    const client = await pool.connect();
    try {
        await client.query("begin");
        const result = await client.query(`
        insert into zigo.assistant_calendar_blocks
          (assistant_id, block_type, source_type, source_id, cluster_id, start_at, end_at, confidence, metadata)
        values ($1::uuid, 'BOOKING', 'service_request', $2::uuid, $3::uuid, $4, $5, 'CONFIRMED', $6::jsonb)
        returning id
      `, [input.assistantId, input.bookingId, input.clusterId, input.startAt, input.endAt, JSON.stringify(input.metadata ?? {})]);
        await refreshAssistantAvailabilityCache(input.assistantId, client);
        await client.query("commit");
        return { id: result.rows[0].id };
    }
    catch (error) {
        await client.query("rollback");
        if (isExclusionConflict(error))
            throw new HttpError(409, "Assistant is already blocked for this time window.");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function stopAssistantCalendarBlocksForBooking(input) {
    await ensureAssistantDispatchSchema();
    const result = await pool.query(`
      update zigo.assistant_calendar_blocks
      set status_code = $2,
          updated_at = now()
      where source_type = 'service_request'
        and source_id = $1::uuid
        and status_code = 'active'
      returning assistant_id as "assistantId"
    `, [input.bookingId, input.status]);
    await Promise.all(result.rows.map((row) => refreshAssistantAvailabilityCache(row.assistantId)));
    return { stopped: result.rowCount ?? 0 };
}
export async function getNextAvailableTime(input) {
    await ensureAssistantDispatchSchema();
    const result = await pool.query(`
      select
        av.assistant_id as "assistantId",
        av.next_available_at as "nextAvailableAt",
        av.next_available_lat as "nextAvailableLat",
        av.next_available_lng as "nextAvailableLng",
        av.next_available_cluster_id as "nextAvailableClusterId",
        av.availability_confidence as "availabilityConfidence",
        av.presence_status as "presenceStatus",
        av.work_status as "workStatus"
      from zigo.assistant_availability av
      join zigo.assistants a on a.id = av.assistant_id
      left join zigo.assistant_cluster_map acm on acm.assistant_id = a.id and coalesce(acm.is_active, true) = true
      where ($1::uuid is null or av.assistant_id = $1::uuid)
        and ($2::uuid is null or a.current_cluster_id = $2::uuid or acm.cluster_id = $2::uuid or av.next_available_cluster_id = $2::uuid)
      order by av.next_available_at asc nulls last
      limit 20
    `, [input.assistantId ?? null, input.clusterId ?? null]);
    return result.rows;
}
export async function checkDispatchAvailability(input) {
    await ensureAssistantDispatchSchema();
    const config = dispatchConfigFromEnv();
    const now = new Date();
    const startAt = input.bookingType === "schedule" && input.startAt ? input.startAt : now;
    const candidates = await shortlistedCandidates(input.clusterId, startAt, input.bookingType);
    const ranked = await rankCandidates({
        candidates,
        destination: input.destination ?? null,
        bookingType: input.bookingType,
        durationMinutes: input.durationMinutes,
        startAt,
        config
    });
    const eligible = ranked.filter((candidate) => candidate.eligible);
    const best = eligible[0] ?? null;
    return {
        available: Boolean(best),
        bestAssistant: best,
        candidates: ranked,
        nextAvailableAt: best?.startAt ?? ranked.find((candidate) => candidate.nextAvailableAt)?.nextAvailableAt ?? null
    };
}
export async function recalculateAssistantAvailability(input) {
    await ensureAssistantDispatchSchema();
    if (input.assistantId)
        return refreshAssistantAvailabilityCache(input.assistantId);
    if (input.bookingId) {
        const result = await pool.query(`
        select distinct assistant_id as "assistantId"
        from zigo.assistant_calendar_blocks
        where source_id = $1::uuid and assistant_id is not null
        union
        select distinct assistant_id as "assistantId"
        from zigo.assistant_capacity_reservations
        where service_request_id = $1::uuid and assistant_id is not null
      `, [input.bookingId]);
        await Promise.all(result.rows.map((row) => refreshAssistantAvailabilityCache(row.assistantId)));
        return { recalculated: result.rows.length };
    }
    const result = await pool.query("select id as \"assistantId\" from zigo.assistants");
    await Promise.all(result.rows.map((row) => refreshAssistantAvailabilityCache(row.assistantId)));
    return { recalculated: result.rows.length };
}
export async function refreshAssistantAvailabilityCache(assistantId, client = pool) {
    await ensureAssistantDispatchSchema(client);
    const config = dispatchConfigFromEnv();
    await client.query(`
      insert into zigo.assistant_availability
        (assistant_id, status_code, presence_status, work_status, availability_confidence, updated_at, status_updated_at)
      values ($1::uuid, 'offline', 'OFFLINE', 'FREE', 'UNKNOWN', now(), now())
      on conflict (assistant_id) do nothing
    `, [assistantId]);
    const result = await client.query(`
      select
        av.latitude,
        av.longitude,
        av.heartbeat_at as "heartbeatAt",
        av.gps_captured_at as "gpsCapturedAt",
        active.block_type as "activeBlockType",
        active.end_at as "activeBlockEndAt",
        active.end_lat as "activeBlockEndLat",
        active.end_lng as "activeBlockEndLng",
        active.cluster_id as "activeBlockClusterId",
        future_busy.end_at as "nextBlockEndAt",
        future_shift.start_at as "futureShiftAt"
      from zigo.assistants a
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join lateral (
        select block_type, end_at, end_lat, end_lng, cluster_id
        from zigo.assistant_calendar_blocks
        where assistant_id = a.id
          and status_code = 'active'
          and block_type <> 'SHIFT'
          and start_at <= now()
          and end_at > now()
        order by end_at desc
        limit 1
      ) active on true
      left join lateral (
        select max(end_at) as end_at
        from zigo.assistant_calendar_blocks
        where assistant_id = a.id
          and status_code = 'active'
          and block_type <> 'SHIFT'
          and end_at > now()
      ) future_busy on true
      left join lateral (
        select start_at
        from zigo.assistant_calendar_blocks
        where assistant_id = a.id
          and status_code = 'active'
          and block_type = 'SHIFT'
          and end_at > now()
        order by start_at
        limit 1
      ) future_shift on true
      where a.id = $1::uuid
      limit 1
    `, [assistantId]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(404, "Assistant profile not found.");
    const now = new Date();
    const heartbeatFresh = row.heartbeatAt ? now.getTime() - row.heartbeatAt.getTime() <= config.heartbeatTimeoutSeconds * 1000 : false;
    const gpsFresh = row.gpsCapturedAt ? now.getTime() - row.gpsCapturedAt.getTime() <= config.gpsFreshnessSeconds * 1000 : false;
    const activeBlock = row.activeBlockType;
    const workStatus = activeBlock ? workStatusForBlock(activeBlock) : "FREE";
    const presenceStatus = heartbeatFresh ? "ONLINE" : row.heartbeatAt ? "STALE" : "OFFLINE";
    const confidence = presenceStatus === "ONLINE" && gpsFresh ? "CONFIRMED" : row.futureShiftAt ? "EXPECTED" : "UNKNOWN";
    const nextAvailableAt = row.nextBlockEndAt && row.nextBlockEndAt > now ? row.nextBlockEndAt : now;
    const nextLat = numberOrNull(row.activeBlockEndLat) ?? numberOrNull(row.latitude);
    const nextLng = numberOrNull(row.activeBlockEndLng) ?? numberOrNull(row.longitude);
    await client.query(`
      update zigo.assistant_availability
      set presence_status = $2,
          work_status = $3,
          availability_confidence = $4,
          next_available_at = $5,
          next_available_lat = $6,
          next_available_lng = $7,
          next_available_cluster_id = $8,
          updated_at = now(),
          status_updated_at = now()
      where assistant_id = $1::uuid
    `, [assistantId, presenceStatus, workStatus, confidence, nextAvailableAt, nextLat, nextLng, row.activeBlockClusterId ?? null]);
    return {
        assistantId,
        presenceStatus,
        workStatus,
        availabilityConfidence: confidence,
        heartbeatFresh,
        gpsFresh,
        nextAvailableAt,
        nextAvailableLat: nextLat,
        nextAvailableLng: nextLng,
        nextAvailableClusterId: row.activeBlockClusterId ?? null
    };
}
async function shortlistedCandidates(clusterId, startAt, bookingType) {
    const config = dispatchConfigFromEnv();
    const result = await pool.query(`
      select distinct on (a.id)
        a.id as "assistantId",
        coalesce(a.current_cluster_id, av.next_available_cluster_id, acm.cluster_id) as "clusterId",
        av.status_code as "statusCode",
        av.presence_status as "presenceStatus",
        av.work_status as "workStatus",
        av.availability_confidence as "availabilityConfidence",
        av.latitude,
        av.longitude,
        av.heartbeat_at as "heartbeatAt",
        av.gps_captured_at as "gpsCapturedAt",
        av.next_available_at as "nextAvailableAt",
        active.end_at as "activeBlockUntil",
        shift.start_at as "futureShiftAt",
        shift.end_at as "futureShiftUntil"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join zigo.assistant_cluster_map acm on acm.assistant_id = a.id and coalesce(acm.is_active, true) = true
      left join lateral (
        select max(end_at) as end_at
        from zigo.assistant_calendar_blocks
        where assistant_id = a.id
          and status_code = 'active'
          and block_type <> 'SHIFT'
          and end_at > $2::timestamptz
      ) active on true
      left join lateral (
        select start_at, end_at
        from zigo.assistant_calendar_blocks
        where assistant_id = a.id
          and status_code = 'active'
          and block_type = 'SHIFT'
          and end_at > $2::timestamptz
        order by start_at
        limit 1
      ) shift on true
      where coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (a.current_cluster_id = $1::uuid or acm.cluster_id = $1::uuid or av.next_available_cluster_id = $1::uuid)
      order by a.id, case when a.current_cluster_id = $1::uuid then 0 else 1 end, acm.cluster_id nulls last
    `, [clusterId, startAt]);
    const now = new Date();
    return result.rows.filter((row) => {
        const presence = normalizePresenceStatus(row.presenceStatus ?? row.statusCode);
        const heartbeatFresh = row.heartbeatAt ? now.getTime() - row.heartbeatAt.getTime() <= config.heartbeatTimeoutSeconds * 1000 : false;
        const gpsFresh = row.gpsCapturedAt ? now.getTime() - row.gpsCapturedAt.getTime() <= config.gpsFreshnessSeconds * 1000 : false;
        if (bookingType === "instant")
            return presence === "ONLINE" && heartbeatFresh && gpsFresh && normalizeWorkStatus(row.workStatus) === "FREE";
        return Boolean(row.futureShiftAt);
    });
}
async function rankCandidates(input) {
    const rows = await Promise.all(input.candidates.map(async (candidate) => {
        const origin = coordinateFromCandidate(candidate);
        const etaMinutes = origin && input.destination
            ? await estimateRoadEtaMinutes(origin, input.destination, input.config)
            : input.config.arrivalBufferMinutes;
        const baseAvailableAt = candidate.activeBlockUntil && candidate.activeBlockUntil > input.startAt
            ? candidate.activeBlockUntil
            : input.startAt;
        const startAt = input.bookingType === "instant"
            ? new Date(Math.max(baseAvailableAt.getTime(), Date.now()) + etaMinutes * 60_000)
            : input.startAt;
        const endAt = new Date(startAt.getTime() + (input.durationMinutes + input.config.wrapUpBufferMinutes + etaMinutes) * 60_000);
        const fitsPromise = input.bookingType === "schedule" || etaMinutes <= input.config.instantPromiseMinutes + input.config.arrivalBufferMinutes;
        const freeAtStart = !candidate.activeBlockUntil || candidate.activeBlockUntil <= input.startAt;
        const eligible = fitsPromise && freeAtStart;
        return {
            assistantId: candidate.assistantId,
            eligible,
            startAt,
            endAt,
            nextAvailableAt: candidate.nextAvailableAt,
            arrivalEtaMinutes: etaMinutes,
            locationFreshnessScore: candidate.gpsCapturedAt ? Math.max(0, Date.now() - candidate.gpsCapturedAt.getTime()) : Number.MAX_SAFE_INTEGER,
            availabilityConfidence: normalizeAvailabilityConfidence(candidate.availabilityConfidence),
            reason: eligible ? null : !freeAtStart ? "calendar_conflict" : "eta_outside_promise"
        };
    }));
    return rows.sort((left, right) => Number(!left.eligible) - Number(!right.eligible)
        || left.arrivalEtaMinutes - right.arrivalEtaMinutes
        || left.locationFreshnessScore - right.locationFreshnessScore
        || left.assistantId.localeCompare(right.assistantId));
}
async function estimateRoadEtaMinutes(origin, destination, config) {
    const directMeters = distanceMeters(origin, destination);
    const fallback = Math.max(1, Math.ceil(((directMeters / 1000) / 18) * 60 * config.travelMultiplier));
    if (!env.OLA_MAPS_API_KEY && (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET))
        return fallback;
    // Keep the adapter best-effort: dispatch must not fail merely because maps is slow or rate-limited.
    try {
        const url = new URL("https://api.olamaps.io/routing/v1/directions/basic");
        url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
        url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
        url.searchParams.set("mode", "two_wheeler");
        const payload = await requestOlaJson(url.pathname, Object.fromEntries(url.searchParams), { method: "POST", timeoutMs: 1200 });
        const route = payload.routes?.[0] || payload.data?.routes?.[0] || payload.route || payload.data?.route;
        const seconds = Number(route?.duration ?? route?.duration_seconds ?? route?.summary?.duration ?? route?.summary?.durationSeconds);
        return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : fallback;
    }
    catch {
        return fallback;
    }
}
function workStatusForBlock(blockType) {
    if (blockType === "TEMPORARY_HOLD")
        return "HELD";
    if (blockType === "TRAVEL")
        return "TRAVELLING";
    if (blockType === "WRAP_UP")
        return "WRAP_UP";
    if (blockType === "BREAK" || blockType === "TIME_OFF" || blockType === "ADMIN_BLOCK")
        return "BREAK";
    return "ASSIGNED";
}
function parseCoordinate(input) {
    if (!input)
        return null;
    const record = input;
    const latitude = numberOrNull(record.latitude ?? record.lat);
    const longitude = numberOrNull(record.longitude ?? record.lng);
    if (latitude == null || longitude == null)
        return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
        return null;
    return { latitude, longitude };
}
function coordinateFromCandidate(candidate) {
    const latitude = numberOrNull(candidate.latitude);
    const longitude = numberOrNull(candidate.longitude);
    return latitude == null || longitude == null ? null : { latitude, longitude };
}
function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
function validDate(value) {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isFinite(date.getTime()) ? date : null;
}
function envNumber(key, fallback) {
    const number = Number(process.env[key]);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function assistantPresenceKey(assistantId) {
    return `assistant:presence:${assistantId}`;
}
async function writePresenceCache(assistantId, status, point) {
    const config = dispatchConfigFromEnv();
    await redisCommand([
        "SET",
        assistantPresenceKey(assistantId),
        JSON.stringify({ status, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null, updatedAt: new Date().toISOString() }),
        "EX",
        String(Math.max(config.heartbeatTimeoutSeconds * 2, 60))
    ]).catch(() => null);
}
function distanceMeters(left, right) {
    const radiusMeters = 6_371_000;
    const lat1 = toRadians(left.latitude);
    const lat2 = toRadians(right.latitude);
    const deltaLat = toRadians(right.latitude - left.latitude);
    const deltaLng = toRadians(right.longitude - left.longitude);
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRadians(value) {
    return value * Math.PI / 180;
}
function isExclusionConflict(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23P01";
}
