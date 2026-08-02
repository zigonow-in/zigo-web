import { pool } from "../../db/pool.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
import { isPointInPolygon, parseWktPolygon } from "../../utils/geofence.js";
import { calculateClusterCategoryPricing } from "../pricing/pricing.js";
import { quotePriceMaster, resolveBookingEngineRuleForContext } from "../masters/masters.repository.js";
import { getBookingEngineSetting, getBookingTypeAutomationSetting } from "../settings/settings.repository.js";
import { ensureBookingEngineSchema, releaseCapacityReservations, upsertBookingOrchestrationState, upsertCapacityReservation } from "./bookingEngine.js";

type Queryable = Pick<typeof pool, "query">;
type LocationSource = "search" | "reverse" | "coordinates" | "default" | "saved" | "whatsapp" | "manual" | "map";
type LocationCandidate = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  source: LocationSource;
  provider?: "ola_maps" | "local";
};

const locationProviderTimeoutMs = 3500;
let olaAccessToken: { token: string; expiresAt: number } | null = null;

const assistantOnlineStatusCodes = new Set(["available", "online", "active", "working"]);

const notServiceableMessage = "This location is not serviceable yet. Please choose another location within an active cluster.";

async function ensureCustomerProfilesForSearch(db: Queryable, term: string) {
  await db.query(
    `
      insert into zigo.customers (user_id, customer_code)
      select
        u.id,
        'CUS-' || upper(replace(u.id::text, '-', '')) as customer_code
      from zigo.users u
      join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false and coalesce(ur.is_active, true) = true
      join zigo.roles r on r.id = ur.role_id and r.code = 'customer' and coalesce(r.is_deleted, false) = false
      left join zigo.customers c on c.user_id = u.id
      where c.id is null
        and u.deleted_at is null
        and (
          u.display_name ilike $1
          or u.email::text ilike $1
          or u.phone ilike $1
          or u.id::text ilike $1
        )
      on conflict (user_id) do nothing
    `,
    [term]
  );
}

export async function listBookings(input: {
  tab?: string;
  page?: number;
  pageSize?: number;
  datePreset?: "today" | "range" | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
} = {}) {
  await ensureBookingEngineSchema();
  const tab = input.tab || "pending_assign";
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(input.pageSize || 20)));
  const offset = (page - 1) * pageSize;
  const startDate = input.datePreset === "all" ? null : input.datePreset === "today" ? "today" : input.startDate || null;
  const endDate = input.datePreset === "all" ? null : input.datePreset === "today" ? "today" : input.endDate || input.startDate || null;
  const search = input.search?.trim() ? `%${input.search.trim()}%` : null;
  const result = await pool.query(
    `
      select
        count(*) over()::int as "totalRecords",
        sr.id,
        sr.request_number as "requestNumber",
        sr.status_code as "statusCode",
        sr.cluster_id as "clusterId",
        cl.name as "clusterName",
        sr.service_id as "serviceId",
        s.name as "serviceName",
        s.code as "serviceCode",
        sr.category_id as "categoryId",
        cat.name as "categoryName",
        cat.code as "categoryCode",
        coalesce(cart_summary.service_names, s.name) as "cartServiceNames",
        coalesce(cart_summary.category_names, cat.name) as "cartCategoryNames",
        cart_summary.store_names as "cartStoreNames",
        sr.notes,
        sr.customer_notes as "customerNotes",
        sr.duration_minutes as "durationMinutes",
        sr.scheduled_at as "scheduledAt",
        service_date.service_date as "serviceDate",
        service_date.service_sort_at as "serviceSortAt",
        sr.metadata,
        coalesce(sr.metadata->>'bookingType', case when sr.scheduled_at is not null then 'schedule' else 'instant' end) as "bookingType",
        sr.metadata->>'scheduledDate' as "scheduledDate",
        sr.metadata->>'scheduledTime' as "scheduledTime",
        sr.metadata->>'assignmentMode' as "assignmentMode",
        booking_queue.tab as "bookingTab",
        os.risk_status as "riskStatus",
        os.supply_status as "supplyStatus",
        os.promised_start_at as "promisedStartAt",
        os.sla_deadline_at as "slaDeadlineAt",
        os.next_check_at as "orchestrationNextCheckAt",
        coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise",
        sr.estimated_amount_paise as "estimatedAmountPaise",
        sr.currency,
        coalesce(payment_summary.payment_type, sr.metadata->>'paymentType', '-') as "paymentType",
        coalesce(payment_summary.is_paid, sr.status_code <> 'payment_pending') as "isPaid",
        coalesce(locations.rows, '[]'::jsonb) as locations,
        coalesce(uploads.rows, '[]'::jsonb) as uploads,
        sr.created_at as "createdAt",
        sr.updated_at as "updatedAt",
        c.id as "customerId",
        c.customer_code as "customerCode",
        u.display_name as "customerName",
        u.email::text as "customerEmail",
        u.phone as "customerPhone",
        u.metadata->>'profilePictureUrl' as "customerProfilePictureUrl",
        ta.status_code as "assignmentStatus",
        ta.offered_at as "assignmentOfferedAt",
        ta.assigned_at as "assignmentAssignedAt",
        a.id as "assistantId",
        a.assistant_code as "assistantCode",
        au.display_name as "assistantName",
        au.phone as "assistantPhone",
        au.email::text as "assistantEmail",
        coalesce(a.metadata->>'verificationStatus', au.metadata->>'accountStatus', 'verifying') as "assistantStatus",
        case
          when coalesce(av.status_code, 'offline') = 'working'
            and coalesce(working_tasks.count, 0) = 0
          then 'available'
          else coalesce(av.status_code, 'offline')
        end as "assistantAvailabilityStatus",
        au.last_login_at as "assistantLastLoginAt",
        case
          when coalesce(au.metadata, '{}'::jsonb) ? 'isLoggedIn' then lower(coalesce(au.metadata->>'isLoggedIn', '')) in ('true', '1', 'yes')
          else au.last_login_at is not null
        end as "assistantIsLoggedIn",
        (
          case
            when av.today_online_date = current_date then coalesce(av.today_online_seconds, 0)
            else 0
          end
          +
          case
            when coalesce(av.status_code, 'offline') in ('available', 'online', 'active', 'working')
              and coalesce(av.online_started_at, av.updated_at) is not null
              and av.today_online_date = current_date
            then greatest(0, extract(epoch from (now() - coalesce(av.online_started_at, av.updated_at)))::int)
            else 0
          end
        ) as "assistantTodayOnlineSeconds",
        a.current_cluster_id as "assistantClusterId",
        acl.name as "assistantClusterName",
        az.name as "assistantZoneName",
        acity.name as "assistantCityName",
        profile_doc.preview_url as "assistantProfilePictureUrl",
        coalesce(working_tasks.count, 0)::int as "assistantWorkingTasks",
        working_tasks."nextAvailableAt" as "assistantNextAvailableAt"
      from zigo.service_requests sr
      join zigo.customers c on c.id = sr.customer_id
      join zigo.users u on u.id = c.user_id
      left join zigo.clusters cl on cl.id = sr.cluster_id
      left join zigo.services s on s.id = sr.service_id
      left join zigo.categories cat on cat.id = sr.category_id
      left join zigo.booking_orchestration_state os on os.service_request_id = sr.id
      left join lateral (
        select
          coalesce(
            sr.scheduled_at::date,
            case
              when sr.metadata->>'scheduledDate' ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date
              else (sr.created_at at time zone 'Asia/Kolkata')::date
            end
          ) as service_date,
          coalesce(sr.scheduled_at, sr.created_at) as service_sort_at
      ) service_date on true
      left join lateral (
        select
          bool_or(pt.status_code in ('paid', 'success', 'captured', 'completed')) as is_paid,
          coalesce(max(pt.provider), '-') as payment_type
        from zigo.payment_transactions pt
        where pt.service_request_id = sr.id
      ) payment_summary on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', rl.id,
            'sequence', rl.sequence,
            'locationType', rl.location_type,
            'name', rl.name,
            'address', rl.address,
            'latitude', rl.latitude,
            'longitude', rl.longitude,
            'notes', rl.notes,
            'metadata', coalesce(rl.metadata, '{}'::jsonb)
          )
          order by rl.sequence
        ) as rows
        from zigo.request_locations rl
        where rl.service_request_id = sr.id
      ) locations on true
      left join lateral (
        select coalesce(jsonb_agg(upload), '[]'::jsonb) as rows
        from (
          select jsonb_build_object('label', 'Booking image', 'url', sr.metadata->>'bookingDetailImageUrl', 'type', 'image') as upload
          where nullif(sr.metadata->>'bookingDetailImageUrl', '') is not null
          union all
          select jsonb_build_object('label', 'Uploaded image', 'url', uploaded.image_url, 'type', 'image')
          from jsonb_array_elements_text(coalesce(sr.metadata->'uploadedImageUrls', '[]'::jsonb)) as uploaded(image_url)
          union all
          select jsonb_build_object(
            'label', coalesce(attachment.item->>'label', attachment.item->>'originalName', 'Upload'),
            'url', coalesce(attachment.item->>'url', attachment.item->>'previewUrl'),
            'type', coalesce(attachment.item->>'type', 'document'),
            'mimeType', attachment.item->>'mimeType'
          )
          from jsonb_array_elements(coalesce(sr.metadata->'bookingAttachments', '[]'::jsonb)) as attachment(item)
          where nullif(coalesce(attachment.item->>'url', attachment.item->>'previewUrl'), '') is not null
        ) upload_rows
      ) uploads on true
      left join lateral (
        select
          string_agg(distinct cart_s.name, ', ' order by cart_s.name) as service_names,
          string_agg(distinct cart_cat.name, ', ' order by cart_cat.name) as category_names,
          string_agg(distinct cart_store.name, ', ' order by cart_store.name) as store_names
        from jsonb_array_elements(coalesce(sr.metadata->'cartItems', '[]'::jsonb)) as cart_item(item)
        left join zigo.services cart_s on cart_s.id = case
          when cart_item.item->>'serviceId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cart_item.item->>'serviceId')::uuid
          else null
        end
        left join zigo.categories cart_cat on cart_cat.id = case
          when cart_item.item->>'categoryId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cart_item.item->>'categoryId')::uuid
          else null
        end
        left join zigo.stores cart_store on cart_store.id = case
          when cart_item.item->>'storeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cart_item.item->>'storeId')::uuid
          else null
        end
      ) cart_summary on true
      left join lateral (
        select *
        from zigo.task_assignments latest_ta
        where (latest_ta.service_request_id = sr.id or latest_ta.request_id = sr.id)
          and latest_ta.status_code not in ('reserved', 'released', 'reassigned')
        order by
          case when latest_ta.id = sr.accepted_assignment_id then 0 else 1 end,
          coalesce(latest_ta.responded_at, latest_ta.assigned_at, latest_ta.offered_at) desc nulls last
        limit 1
      ) ta on true
      left join lateral (
        select case
          when sr.status_code in ('cancelled', 'canceled') or ta.status_code in ('cancelled', 'canceled') then 'cancelled'
          when sr.status_code in ('completed', 'success') or ta.status_code in ('completed', 'success') then 'success'
          when sr.status_code in ('failed', 'rejected') or ta.status_code in ('failed', 'rejected', 'declined', 'not_accepted') then 'rejected'
          when sr.status_code in ('draft', 'hold', 'on_hold') or ta.status_code in ('hold', 'on_hold') then 'hold'
          when sr.status_code in ('in_progress', 'approval_pending') or ta.status_code in ('in_progress', 'approval_pending') then 'working'
          when sr.status_code in ('assigned', 'accepted') or ta.status_code in ('offered', 'assigned', 'accepted') then 'assigned'
          when sr.status_code in ('payment_pending', 'paid', 'queued') then 'pending_assign'
          else coalesce(nullif(sr.status_code, ''), 'pending_assign')
        end as tab
      ) booking_queue on true
      left join zigo.assistants a on a.id = ta.assistant_id
      left join zigo.users au on au.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join zigo.clusters acl on acl.id = a.current_cluster_id
      left join zigo.cities acity on acity.id = acl.city_id
      left join zigo.zones az on az.id = acl.zone_id
      left join lateral (
        select f.object_key as preview_url
        from zigo.assistant_documents ad
        left join zigo.document_types dt on dt.id = ad.document_type_id
        left join zigo.files f on f.id = ad.file_id
        where ad.assistant_id = a.id and dt.code in ('profile_picture', 'profile_photo')
        order by ad.created_at desc
        limit 1
      ) profile_doc on true
      left join lateral (
        select
          count(*) as count,
          max(coalesce(
            wsr.booking_available_at,
            nullif(wsr.metadata->>'bookingAvailableAt', '')::timestamptz,
            nullif(wsr.metadata->>'expectedFreeAt', '')::timestamptz,
            wsr.created_at + (coalesce(wsr.duration_minutes, 30) || ' minutes')::interval
          )) as "nextAvailableAt"
        from zigo.task_assignments wta
        join zigo.service_requests wsr on (wsr.id = wta.service_request_id or wsr.id = wta.request_id)
        where wta.assistant_id = a.id
          and wta.status_code in ('in_progress', 'approval_pending')
          and wsr.status_code in ('in_progress', 'approval_pending')
      ) working_tasks on true
      where booking_queue.tab = $1
      and (
        $2::text is null
        or service_date.service_date >= case when $2::text = 'today' then (now() at time zone 'Asia/Kolkata')::date else $2::date end
      )
      and (
        $3::text is null
        or service_date.service_date <= case when $3::text = 'today' then (now() at time zone 'Asia/Kolkata')::date else $3::date end
      )
      and (
        $4::text is null
        or sr.request_number ilike $4
        or sr.id::text ilike $4
        or coalesce(u.display_name, '') ilike $4
        or coalesce(u.phone, '') ilike $4
        or coalesce(u.email::text, '') ilike $4
        or coalesce(c.customer_code, '') ilike $4
        or coalesce(s.name, '') ilike $4
        or coalesce(s.code, '') ilike $4
        or coalesce(cat.name, '') ilike $4
        or coalesce(cl.name, '') ilike $4
        or coalesce(au.display_name, '') ilike $4
        or coalesce(au.phone, '') ilike $4
        or coalesce(a.assistant_code, '') ilike $4
      )
      order by service_date.service_sort_at desc, sr.created_at desc
      limit $5 offset $6
    `,
    [tab, startDate, endDate, search, pageSize, offset]
  );
  const totalRecords = Number(result.rows[0]?.totalRecords || 0);
  return {
    data: result.rows.map(({ totalRecords: _totalRecords, ...row }) => row),
    pagination: {
      page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize))
    }
  };
}

export async function searchCustomersForBooking(search: string) {
  const term = `%${search.trim()}%`;
  await ensureCustomerProfilesForSearch(pool, term);
  const result = await pool.query(
    `
      select
        c.id as "customerId",
        c.customer_code as "customerCode",
        u.display_name as "customerName",
        u.email::text as email,
        u.phone,
        coalesce(u.metadata->>'accountStatus', 'active') as status,
        ca.id as "addressId",
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        ca.is_default as "isDefault"
      from zigo.customers c
      join zigo.users u on u.id = c.user_id
      left join lateral (
        select *
        from zigo.customer_addresses ca
        where ca.customer_id = c.id
          and ca.deleted_at is null
          and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
        order by ca.is_default desc, ca.created_at desc
        limit 1
      ) ca on true
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where u.deleted_at is null
        and (
          u.display_name ilike $1
          or u.email::text ilike $1
          or u.phone ilike $1
          or c.customer_code ilike $1
        )
      order by u.display_name nulls last, c.created_at desc
      limit 25
    `,
    [term]
  );
  return result.rows;
}

export async function listCustomerAddressesForBooking(customerId: string) {
  await assertBookingCustomer(customerId);
  const result = await pool.query(
    `
      select
        ca.id as "addressId",
        ca.label,
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        ca.is_default as "isDefault"
      from zigo.customer_addresses ca
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where ca.customer_id = $1
        and ca.deleted_at is null
        and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
      order by ca.is_default desc, ca.created_at desc
    `,
    [customerId]
  );
  return result.rows;
}

export async function validateBookingLocation(input: {
  customerId: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  addressId?: string | null;
  source?: string | null;
}) {
  const customer = await assertBookingCustomer(input.customerId);
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpError(400, "Latitude and longitude are required.");
  }
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new HttpError(400, "Latitude or longitude is outside the valid range.");
  }
  if (input.addressId) {
    const address = await pool.query(
      `
        select id
        from zigo.customer_addresses
        where id = $1
          and customer_id = $2
          and deleted_at is null
        limit 1
      `,
      [input.addressId, input.customerId]
    );
    if (!address.rows[0]) throw new HttpError(400, "Selected address was not found for this customer.");
  }

  const clusters = await pool.query(
    `
      select
        cl.id,
        cl.name,
        cl.code,
        cl.polygon_description as "polygonDescription",
        cl.metadata,
        cl.priority,
        city.name as "cityName",
        z.name as "zoneName",
        coalesce((cl.metadata->>'isPinned')::boolean, false) as "isPinned",
        coalesce((cl.metadata->>'pinPriority')::int, 0) as "pinPriority"
      from zigo.clusters cl
      left join zigo.cities city on city.id = cl.city_id
      left join zigo.states state on state.id = city.state_id
      left join zigo.zones z on z.id = cl.zone_id
      where coalesce(cl.is_deleted, false) = false
        and coalesce(cl.is_booking_enabled, false) = true
        and coalesce(city.is_active, true) = true
        and coalesce(city.is_deleted, false) = false
        and coalesce(state.is_active, true) = true
        and coalesce(state.is_deleted, false) = false
        and (cl.zone_id is null or (coalesce(z.is_active, true) = true and coalesce(z.is_deleted, false) = false))
      order by coalesce((cl.metadata->>'isPinned')::boolean, false) desc,
               coalesce((cl.metadata->>'pinPriority')::int, 0),
               cl.priority,
               cl.name
    `
  );

  for (const cluster of clusters.rows) {
    const polygon = parseWktPolygon(cluster.polygonDescription);
    const serviceRangeMeters = Number(cluster.metadata?.serviceRangeMeters);
    const rangeCenter = clusterRangeCenter(cluster, polygon);
    const insidePolygon = polygon.length >= 4 && isPointInPolygon(input.latitude, input.longitude, polygon);
    const withinRange = Number.isFinite(serviceRangeMeters) && serviceRangeMeters > 0 && rangeCenter
      ? distanceMeters([input.longitude, input.latitude], rangeCenter) <= serviceRangeMeters
      : false;
    const hasConfiguredBoundary = polygon.length >= 4 || (Number.isFinite(serviceRangeMeters) && serviceRangeMeters > 0 && rangeCenter);
    if (!hasConfiguredBoundary || (!insidePolygon && !withinRange)) continue;
    return {
      isServiceable: true,
      message: "Location is serviceable.",
      location: {
        customerId: customer.id,
        addressId: input.addressId ?? null,
        address: input.address ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source ?? "manual"
      },
      cluster: {
        clusterId: cluster.id,
        name: cluster.name,
        code: cluster.code,
        cityName: cluster.cityName,
        zoneName: cluster.zoneName,
        polygonCoordinates: polygon.map(([longitude, latitude]) => ({ latitude, longitude })),
        serviceRangeMeters: Number.isFinite(serviceRangeMeters) && serviceRangeMeters > 0 ? serviceRangeMeters : null
      }
    };
  }

  return {
    isServiceable: false,
    message: notServiceableMessage,
    location: {
      customerId: customer.id,
      addressId: input.addressId ?? null,
      address: input.address ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source ?? "manual"
    },
    cluster: null
  };
}

export async function searchBookingLocations(query: string) {
  const text = query.trim();
  const direct = directCoordinateCandidate(text);
  if (direct) return [direct];

  const placeLookups = await Promise.allSettled([
    fetchOlaPlaceCandidates("autocomplete", text),
    fetchOlaPlaceCandidates("textsearch", text)
  ]);
  const placeCandidates = placeLookups.flatMap((lookup) => (lookup.status === "fulfilled" ? lookup.value : []));
  if (placeCandidates.length) return rankLocationCandidates(placeCandidates, text).slice(0, 12);

  const geocodeLookup = await Promise.allSettled([fetchOlaLocationCandidates("geocode", text)]);
  const candidates = geocodeLookup.flatMap((lookup) => (lookup.status === "fulfilled" ? lookup.value : []));
  if (candidates.length) return rankLocationCandidates(candidates, text).slice(0, 12);

  const lookups = [...placeLookups, ...geocodeLookup];
  const rejected = lookups.filter((lookup): lookup is PromiseRejectedResult => lookup.status === "rejected");
  const firstError = rejected[0]?.reason;
  if (rejected.length === lookups.length && firstError instanceof HttpError) throw firstError;
  throw new HttpError(502, "Ola Places did not return any places for this search.");
}

export async function reverseBookingLocation(input: { latitude: number; longitude: number }) {
  assertCoordinateRange(input.latitude, input.longitude);
  const result = await fetchOlaReverseGeocode(input.latitude, input.longitude);
  return {
    label: result?.label || "Picked location",
    address: result?.address || formatCoordinateAddress(input.latitude, input.longitude),
    latitude: input.latitude,
    longitude: input.longitude,
    source: "reverse" as const,
    provider: result?.provider || "local"
  };
}

function clusterRangeCenter(cluster: { metadata?: Record<string, unknown> | null }, polygon: [number, number][]) {
  const metadata = cluster.metadata || {};
  const latitude = Number(metadata.serviceCenterLatitude ?? metadata.centerLatitude ?? metadata.latitude);
  const longitude = Number(metadata.serviceCenterLongitude ?? metadata.centerLongitude ?? metadata.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return [longitude, latitude] as [number, number];
  if (polygon.length >= 4) return polygonCentroid(polygon);
  return null;
}

async function fetchOlaLocationCandidates(kind: "autocomplete" | "geocode", query: string) {
  const payload = await requestOlaMaps(kind, (url) => {
    url.searchParams.set(kind === "autocomplete" ? "input" : "address", query);
    url.searchParams.set("language", "en");
    if (kind === "autocomplete") {
      url.searchParams.set("location", "28.6139,77.2090");
      url.searchParams.set("radius", "100000");
    }
  });
  return collectLocationCandidates(payload, query);
}

async function fetchOlaPlaceCandidates(kind: "autocomplete" | "textsearch", query: string) {
  const payload = await requestOlaMaps(kind, (url) => {
    if (kind === "autocomplete") {
      url.searchParams.set("input", query);
      url.searchParams.set("location", "28.4595,77.0266");
      url.searchParams.set("radius", "150000");
    } else {
      url.searchParams.set("query", query);
    }
    url.searchParams.set("language", "en");
  });
  return collectLocationCandidates(payload, query, "search");
}

async function fetchOlaReverseGeocode(latitude: number, longitude: number) {
  const payload = await requestOlaMaps("reverse-geocode", (url) => {
    url.searchParams.set("latlng", `${latitude},${longitude}`);
  });
  return collectLocationCandidates(payload, "Picked location", "reverse")[0] ?? null;
}

async function requestOlaMaps(path: "autocomplete" | "textsearch" | "geocode" | "reverse-geocode", configure: (url: URL) => void) {
  if (!env.OLA_MAPS_API_KEY && (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET)) {
    throw new HttpError(503, "Ola Maps credentials are not configured. Add OLA_MAPS_API_KEY or OAuth client credentials and restart the admin server.");
  }
  const url = new URL(`https://api.olamaps.io/places/v1/${path}`);
  const token = await getOlaAccessToken().catch(() => null);
  if (!token && env.OLA_MAPS_API_KEY) url.searchParams.set("api_key", env.OLA_MAPS_API_KEY);
  configure(url);

  const response = await fetchWithTimeout(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
      Origin: env.CORS_ORIGIN === "*" ? `http://localhost:${env.PORT}` : env.CORS_ORIGIN,
      Referer: env.CORS_ORIGIN === "*" ? `http://localhost:${env.PORT}/` : `${env.CORS_ORIGIN.replace(/\/$/, "")}/`,
      "X-Request-Id": `zigo-admin-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
  }).catch(() => null);
  if (!response) throw new HttpError(504, "Ola Maps did not respond. Please try again.");

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (isOlaDomainRestriction(payload)) {
      throw new HttpError(502, "Ola Places rejected this domain. Add the admin URL to the Ola Maps credential domain whitelist, then search again.");
    }
    throw new HttpError(response.status || 502, locationSearchErrorMessage(payload, "Ola Maps location lookup failed."));
  }
  return payload;
}

async function getOlaAccessToken() {
  if (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET) return null;
  if (olaAccessToken && olaAccessToken.expiresAt > Date.now() + 30_000) return olaAccessToken.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.OLA_MAPS_CLIENT_ID,
    client_secret: env.OLA_MAPS_CLIENT_SECRET
  });
  const response = await fetchWithTimeout(new URL(env.OLA_MAPS_TOKEN_URL), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    olaAccessToken = null;
    throw new HttpError(response.status || 502, locationSearchErrorMessage(payload, "Ola Maps OAuth token request failed."));
  }
  const expiresIn = Number(payload.expires_in ?? 300);
  olaAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000
  };
  return olaAccessToken.token;
}

async function fetchWithTimeout(url: URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), locationProviderTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function directCoordinateCandidate(value: string): LocationCandidate | null {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!isValidCoordinate(latitude, longitude)) return null;
  return { label: "Entered coordinates", address: formatCoordinateAddress(latitude, longitude), latitude, longitude, source: "coordinates", provider: "local" };
}

function locationSearchErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const item = payload as Record<string, unknown>;
  return String(item.message || item.error || item.error_message || fallback);
}

function isOlaDomainRestriction(payload: unknown) {
  return /domain is not allowed|domain.*not allowed/i.test(locationSearchErrorMessage(payload, ""));
}

function collectLocationCandidates(payload: unknown, fallbackText = "Searched location", source: LocationSource = "search") {
  const results: LocationCandidate[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = value as Record<string, unknown>;
    const lat = numberFromUnknown(item.lat ?? item.latitude ?? item.y);
    const lng = numberFromUnknown(item.lng ?? item.lon ?? item.longitude ?? item.x);
    const geometry = item.geometry as Record<string, unknown> | undefined;
    const location = item.location as Record<string, unknown> | undefined;
    const position = item.position as Record<string, unknown> | undefined;
    const geometryLocation = geometry?.location as Record<string, unknown> | undefined;
    const nestedLat = numberFromUnknown(geometry?.lat ?? geometry?.latitude ?? geometryLocation?.lat ?? geometryLocation?.latitude ?? location?.lat ?? location?.latitude ?? position?.lat ?? position?.latitude);
    const nestedLng = numberFromUnknown(geometry?.lng ?? geometry?.lon ?? geometry?.longitude ?? geometryLocation?.lng ?? geometryLocation?.lon ?? geometryLocation?.longitude ?? location?.lng ?? location?.lon ?? location?.longitude ?? position?.lng ?? position?.lon ?? position?.longitude);
    const latitude = lat ?? nestedLat;
    const longitude = lng ?? nestedLng;
    if (latitude != null && longitude != null && isValidCoordinate(latitude, longitude)) {
      const structuredFormatting = item.structured_formatting as Record<string, unknown> | undefined;
      const textValue = item.name || structuredFormatting?.main_text || item.description || item.formatted_address || item.formattedAddress || item.address || item.vicinity;
      const label = String(textValue || fallbackText);
      const secondaryText = structuredFormatting?.secondary_text ? String(structuredFormatting.secondary_text) : "";
      const address = String(item.formatted_address || item.formattedAddress || item.address || item.description || item.vicinity || secondaryText || textValue || fallbackText || label);
      const key = `${latitude.toFixed(6)},${longitude.toFixed(6)},${label}`;
      if (textValue && !seen.has(key)) {
        seen.add(key);
        results.push({ label, address, latitude, longitude, source, provider: "ola_maps" });
      }
    }
    for (const child of Object.values(item)) visit(child);
  };
  visit(payload);
  return results;
}

function rankLocationCandidates(candidates: LocationCandidate[], query: string) {
  const queryText = query.toLowerCase();
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
    .map((candidate) => {
      const text = `${candidate.label} ${candidate.address}`.toLowerCase();
      const score =
        (text.includes(queryText) ? 100 : 0) +
        (text.startsWith(queryText) ? 20 : 0) +
        (candidate.provider === "ola_maps" ? 8 : 0) -
        Math.abs(candidate.latitude - 28.6139) * 0.05 -
        Math.abs(candidate.longitude - 77.209) * 0.05;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate)
    .filter((candidate) => {
      const key = `${candidate.latitude.toFixed(5)},${candidate.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function numberFromUnknown(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function assertCoordinateRange(latitude: number, longitude: number) {
  if (!isValidCoordinate(latitude, longitude)) throw new HttpError(400, "Latitude or longitude is outside the valid range.");
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function formatCoordinateAddress(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

async function assertBookingCustomer(customerId: string) {
  const result = await pool.query(
    `
      select
        c.id,
        u.display_name as "displayName",
        coalesce(u.metadata->>'accountStatus', 'active') as status
      from zigo.customers c
      join zigo.users u on u.id = c.user_id
      where c.id = $1
        and u.deleted_at is null
      limit 1
    `,
    [customerId]
  );
  const customer = result.rows[0];
  if (!customer) throw new HttpError(400, "Selected customer was not found.");
  if (customer.status !== "active") {
    throw new HttpError(400, `Customer "${customer.displayName || customerId}" is not active. Activate the customer before selecting booking location.`);
  }
  return customer;
}

function polygonCentroid(polygon: [number, number][]) {
  const points = polygon.slice(0, -1);
  if (!points.length) return [0, 0] as [number, number];
  const totals = points.reduce(
    (sum, [longitude, latitude]) => ({ longitude: sum.longitude + longitude, latitude: sum.latitude + latitude }),
    { longitude: 0, latitude: 0 }
  );
  return [totals.longitude / points.length, totals.latitude / points.length] as [number, number];
}

function distanceMeters(from: [number, number], to: [number, number]) {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function activeTimeCategories(categories: unknown[]) {
  return (categories || [])
    .filter((category): category is Record<string, unknown> => Boolean(category) && typeof category === "object")
    .filter((category) => category.isActive !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function normalizeBookingTypeRow(row: Record<string, unknown> | undefined | null) {
  const bookingType = row?.bookingType === "schedule" ? "schedule" : "instant";
  return {
    id: row?.id ?? null,
    bookingType,
    instantMode: "manual",
    waitWindowMinutes: 0,
    waitWindowNote: "",
    maxAdvanceDays: bookingType === "schedule" ? Number(row?.maxAdvanceDays || 1) : 0,
    allowedDays: Array.isArray(row?.allowedDays) ? row.allowedDays : [],
    timeCategories: activeTimeCategories(Array.isArray(row?.timeCategories) ? row.timeCategories : []),
    timeSlots: Array.isArray(row?.timeSlots) ? row.timeSlots : []
  };
}

type NormalizedBookingType = ReturnType<typeof normalizeBookingTypeRow>;
type ClusterBookingConfig = {
  mode?: "both" | "instant" | "schedule";
  instantMode?: "both" | "automate" | "manual";
  waitWindowMinutes?: number;
  waitWindowNote?: string;
  maxAdvanceDays?: number;
  allowedDays?: unknown[];
  timeCategories?: unknown[];
  timeSlots?: string[];
  isActive?: boolean;
};

function asBookingConfig(value: unknown): ClusterBookingConfig | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.isActive === false) return null;
  return row as ClusterBookingConfig;
}

function bookingConfigMode(config: ClusterBookingConfig | null | undefined) {
  return config?.mode === "schedule" || config?.mode === "instant" || config?.mode === "both" ? config.mode : null;
}

function bookingConfigAssignType(config: ClusterBookingConfig | null | undefined) {
  return config?.instantMode === "automate" ? "automate" : config?.instantMode === "manual" ? "manual" : null;
}

function bookingConfigWaitWindow(config: ClusterBookingConfig | null | undefined) {
  const value = Number(config?.waitWindowMinutes);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

async function resolveBookingAvailabilityConfig(db: Queryable, input: {
  clusterId: string;
  serviceId?: string | null;
  categoryId?: string | null;
}) {
  const bookingTypes = await db.query<{
    id: string;
    bookingType: "instant" | "schedule";
    instantMode: "manual" | "automate";
    waitWindowMinutes: number;
    waitWindowNote: string;
    maxAdvanceDays: number;
    allowedDays: string[];
    timeCategories: unknown[];
    timeSlots: string[];
  }>(
    `
      select id,
        booking_type as "bookingType",
        'manual' as "instantMode",
        coalesce((config->>'waitWindowMinutes')::int, 0) as "waitWindowMinutes",
        coalesce(config->>'waitWindowNote', '') as "waitWindowNote",
        coalesce((config->>'maxAdvanceDays')::int, 0) as "maxAdvanceDays",
        coalesce(config->'allowedDays', '[]'::jsonb) as "allowedDays",
        coalesce(config->'timeCategories', '[]'::jsonb) as "timeCategories",
        coalesce(config->'timeSlots', '[]'::jsonb) as "timeSlots"
      from zigo.booking_type_masters
      where coalesce(is_deleted, false) = false
        and is_active = true
      order by is_default desc, booking_type, updated_at desc
    `
  );
  const defaultType = normalizeBookingTypeRow(bookingTypes.rows[0]);
  const instantType = normalizeBookingTypeRow(bookingTypes.rows.find((row) => row.bookingType === "instant") ?? bookingTypes.rows[0]);
  const scheduleType = normalizeBookingTypeRow(bookingTypes.rows.find((row) => row.bookingType === "schedule") ?? bookingTypes.rows[0]);

  const settings = await getBookingTypeAutomationSetting();
  let categoryConfig: ClusterBookingConfig | null = null;
  let serviceConfig: ClusterBookingConfig | null = null;
  if (input.categoryId) {
    const category = await db.query<{ bookingTypeConfig: ClusterBookingConfig; serviceId: string | null }>(
      `
        select
          coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
          c.service_id as "serviceId"
        from zigo.cluster_category_settings m
        join zigo.categories c on c.id = m.category_id
        where m.cluster_id = $1
          and m.category_id = $2
          and coalesce(m.is_deleted, false) = false
          and coalesce(m.is_active, true) = true
          and coalesce(m.is_enabled, true) = true
        order by m.updated_at desc
        limit 1
      `,
      [input.clusterId, input.categoryId]
    );
    categoryConfig = asBookingConfig(category.rows[0]?.bookingTypeConfig);
  }
  if (input.serviceId) {
    const service = await db.query<{ bookingTypeConfig: ClusterBookingConfig }>(
      `
        select coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig"
        from zigo.cluster_service_settings m
        where m.cluster_id = $1
          and m.service_id = $2
          and coalesce(m.is_deleted, false) = false
          and coalesce(m.is_active, true) = true
          and coalesce(m.is_enabled, true) = true
        order by m.updated_at desc
        limit 1
      `,
      [input.clusterId, input.serviceId]
    );
    serviceConfig = asBookingConfig(service.rows[0]?.bookingTypeConfig);
  }

  const configs = [categoryConfig, serviceConfig].filter(Boolean) as ClusterBookingConfig[];
  const mode = configs.map(bookingConfigMode).find(Boolean) ?? (defaultType.bookingType === "schedule" ? "schedule" : "instant");
  const assignType = configs.map(bookingConfigAssignType).find(Boolean) ?? "manual";
  const waitWindowMinutes = configs.map(bookingConfigWaitWindow).find((value): value is number => value != null)
    ?? 0;
  const waitWindowNote = configs.map((config) => config.waitWindowNote).find(Boolean) ?? "";
  const scheduleSource = mode === "schedule" ? categoryConfig || serviceConfig || scheduleType : scheduleType;
  const scheduleConfig: NormalizedBookingType = {
    ...scheduleType,
    waitWindowMinutes,
    waitWindowNote,
    maxAdvanceDays: Number(scheduleSource?.maxAdvanceDays ?? scheduleType.maxAdvanceDays ?? 1),
    allowedDays: Array.isArray(scheduleSource?.allowedDays) ? scheduleSource.allowedDays : scheduleType.allowedDays,
    timeCategories: activeTimeCategories(Array.isArray(scheduleSource?.timeCategories) ? scheduleSource.timeCategories : scheduleType.timeCategories),
    timeSlots: Array.isArray(scheduleSource?.timeSlots) && scheduleSource.timeSlots.length ? scheduleSource.timeSlots : scheduleType.timeSlots
  };
  const effectiveConfig: NormalizedBookingType = {
    ...(mode === "schedule" ? scheduleConfig : instantType),
    bookingType: mode === "schedule" ? "schedule" : "instant",
    instantMode: assignType,
    waitWindowMinutes,
    waitWindowNote
  };
  return {
    settings,
    defaultType,
    instantType,
    scheduleType: scheduleConfig,
    effectiveConfig,
    bookingMode: mode,
    assignType,
    waitWindowMinutes
  };
}

function scheduleDatesForConfig(config: { maxAdvanceDays: number; allowedDays: unknown[] }) {
  const maxAdvanceDays = Math.max(0, Number(config.maxAdvanceDays || 0));
  const allowed = new Set((config.allowedDays || []).map((item) => String(item).toLowerCase()));
  const dates: Array<{ value: string; label: string; day: string }> = [];
  for (let offset = 0; offset <= maxAdvanceDays; offset += 1) {
    const token = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `next_${offset}`;
    if (allowed.size && !allowed.has(token) && !allowed.has(String(offset))) continue;
    const date = new Date();
    date.setDate(date.getDate() + offset);
    dates.push({
      value: localDateText(date),
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : String(date.getDate()).padStart(2, "0"),
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
    });
  }
  return dates;
}

function scheduleSlotDate(dateValue: string, timeValue: string) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  const [hour, minute] = String(timeValue || "").split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function scheduleSlotEnd(dateValue: string, timeValue: string, durationMinutes: number) {
  const start = scheduleSlotDate(dateValue, timeValue);
  if (!start) return null;
  return new Date(start.getTime() + Math.max(1, Math.min(1440, Math.round(Number(durationMinutes || 30)))) * 60_000);
}

function nextOpenCapacityWindow(input: {
  slotStart: Date;
  slotEnd: Date;
  baseAvailableAt?: Date | null;
  latestStartAt?: Date;
  durationMinutes?: number;
  scheduledWindows?: Array<{ start: Date; end: Date }>;
}) {
  const durationMs = input.durationMinutes
    ? Math.max(1, Number(input.durationMinutes || 30)) * 60_000
    : Math.max(1, input.slotEnd.getTime() - input.slotStart.getTime());
  let candidateStartAt = new Date(Math.max(input.slotStart.getTime(), input.baseAvailableAt?.getTime() || 0));
  let candidateEndAt = new Date(candidateStartAt.getTime() + durationMs);
  const latestStartAt = input.latestStartAt ?? input.slotStart;
  const windows = [...(input.scheduledWindows || [])].sort((left, right) => left.start.getTime() - right.start.getTime());
  let moved = true;
  while (moved) {
    moved = false;
    for (const window of windows) {
      if (candidateStartAt < window.end && candidateEndAt > window.start) {
        candidateStartAt = new Date(window.end);
        candidateEndAt = new Date(candidateStartAt.getTime() + durationMs);
        moved = true;
        break;
      }
    }
  }
  if (candidateStartAt.getTime() > latestStartAt.getTime()) return null;
  return { candidateStartAt, candidateEndAt };
}

function localDateText(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function localTimeText(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function shortDurationLabel(minutes: number) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  if (value < 60) return `${value} mins`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours} hr${hours === 1 ? "" : "s"}${mins ? ` ${mins} mins` : ""}`;
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + Math.max(0, Math.round(Number(minutes || 0))) * 60_000);
}

function minutesUntil(from: Date, to: Date | null) {
  if (!to) return null;
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 60_000));
}

function bookingEngineRuleOpen(rule: any, now = new Date()) {
  if (!rule) return true;
  if (rule.serviceControlMode === "manual") return rule.manualServiceStatus === "start";
  if (rule.serviceControlMode === "auto") {
    const start = rule.autoStartAt ? new Date(rule.autoStartAt) : null;
    const end = rule.autoEndAt ? new Date(rule.autoEndAt) : null;
    if (start && Number.isFinite(start.getTime()) && now.getTime() < start.getTime()) return false;
    if (end && Number.isFinite(end.getTime()) && now.getTime() > end.getTime()) return false;
  }
  return true;
}

function bookingSupplyStatusFor(input: { assignmentMode: string; assistantId?: string | null; bookingType: string }) {
  if (!input.assistantId) return "unassigned";
  if (input.assignmentMode === "automate") return "assigned";
  return input.bookingType === "schedule" ? "reserved_for_manual" : "reserved_for_manual";
}

function bookingDemandStatusFor(statusCode: string) {
  if (["assigned", "accepted", "in_progress", "approval_pending", "completed", "cancelled", "failed", "rejected"].includes(statusCode)) return statusCode;
  if (["payment_pending", "paid", "queued"].includes(statusCode)) return "pending_assign";
  return statusCode || "pending_assign";
}

async function selectAssistantForCapacityWindow(db: Queryable, input: {
  clusterId: string;
  slotStart: Date;
  slotEnd: Date;
  scheduledDate: string;
  latestStartAt?: Date;
  durationMinutes?: number;
}) {
  const assistants = await db.query<{
    assistantId: string;
    statusCode: string;
    busyFreeAt: Date | null;
    futureScheduledCount: number;
  }>(
    `
      select
        a.id as "assistantId",
        lower(coalesce(av.status_code, 'offline')) as "statusCode",
        active_work."busyFreeAt" as "busyFreeAt",
        coalesce(future_schedule."futureScheduledCount", 0)::int as "futureScheduledCount"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join lateral (
        select max(coalesce(
          sr.booking_available_at,
          nullif(sr.metadata->>'bookingAvailableAt', '')::timestamptz,
          nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz,
          sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
        )) as "busyFreeAt"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType', 'instant') <> 'schedule'
      ) active_work on true
      left join lateral (
        select count(*) as "futureScheduledCount"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and (
            coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date) > current_date
            or (
              coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date) = current_date
              and coalesce(sr.booking_time_slot, sr.metadata->>'scheduledTime', to_char(sr.scheduled_at, 'HH24:MI')) >= to_char(now(), 'HH24:MI')
            )
          )
      ) future_schedule on true
      where u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (
          a.current_cluster_id = $1
          or exists (
            select 1
            from zigo.assistant_cluster_map acm
            where acm.assistant_id = a.id
              and acm.cluster_id = $1
              and coalesce(acm.is_active, true) = true
          )
        )
        and coalesce(av.status_code, 'offline') = any($2::text[])
      order by a.id
      for update of a
    `,
    [input.clusterId, Array.from(assistantOnlineStatusCodes)]
  );
  if (!assistants.rows.length) return null;
  const blocked = await db.query<{ assistantId: string; startAt: Date | null; endAt: Date | null; scheduledDate: string | null; scheduledTime: string | null; durationMinutes: number }>(
    `
      select
        ta.assistant_id as "assistantId",
        coalesce(
          sr.booking_start_at,
          sr.scheduled_at,
          nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time
        ) as "startAt",
        coalesce(
          sr.booking_available_at,
          nullif(sr.metadata->>'bookingAvailableAt', '')::timestamptz,
          nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz,
          sr.booking_end_at,
          sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
          (nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
        ) as "endAt",
        sr.metadata->>'scheduledDate' as "scheduledDate",
        sr.metadata->>'scheduledTime' as "scheduledTime",
        coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
      from zigo.task_assignments ta
      join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
      where ta.assistant_id = any($1::uuid[])
        and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
        and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
        and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
        and coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date) >= $2::date
    `,
    [assistants.rows.map((assistant) => assistant.assistantId), localDateText(new Date())]
  );
  const scheduledByAssistant = new Map<string, Array<{ start: Date; end: Date }>>();
  for (const row of blocked.rows) {
    const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
    if (!start) continue;
    const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
    if (!scheduledByAssistant.has(row.assistantId)) scheduledByAssistant.set(row.assistantId, []);
    scheduledByAssistant.get(row.assistantId)!.push({ start, end });
  }
  const latestStartAt = input.latestStartAt ?? input.slotStart;
  return assistants.rows
    .map((assistant) => {
      const nextAvailableAt = assistant.busyFreeAt ?? new Date();
      const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
      const window = nextOpenCapacityWindow({
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        baseAvailableAt: nextAvailableAt,
        latestStartAt,
        durationMinutes: input.durationMinutes,
        scheduledWindows: scheduled
      });
      return window ? { ...assistant, nextAvailableAt, ...window } : null;
    })
    .filter((assistant): assistant is NonNullable<typeof assistant> => Boolean(assistant))
    .sort((left, right) =>
      left.candidateStartAt.getTime() - right.candidateStartAt.getTime() ||
      Number(left.futureScheduledCount || 0) - Number(right.futureScheduledCount || 0) ||
      left.assistantId.localeCompare(right.assistantId)
    )[0] ?? null;
}

async function selectScheduleAssistantForSlot(db: Queryable, input: {
  clusterId: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
}) {
  const slotStart = scheduleSlotDate(input.scheduledDate, input.scheduledTime);
  const slotEnd = scheduleSlotEnd(input.scheduledDate, input.scheduledTime, input.durationMinutes);
  if (!slotStart || !slotEnd || slotStart.getTime() <= Date.now()) return null;
  return selectAssistantForCapacityWindow(db, { clusterId: input.clusterId, slotStart, slotEnd, scheduledDate: input.scheduledDate });
}

export async function getBookingAvailabilityDecision(input: {
  clusterId: string;
  locationClusterIds?: string[];
  serviceId?: string | null;
  categoryId?: string | null;
  durationMinutes?: number;
  waitWindowMinutes?: number;
  latitude?: number | null;
  longitude?: number | null;
}) {
  await ensureBookingEngineSchema();
  const resolvedConfig = await resolveBookingAvailabilityConfig(pool, {
    clusterId: input.clusterId,
    serviceId: input.serviceId ?? null,
    categoryId: input.categoryId ?? null
  });
  const engineSettings = await getBookingEngineSetting();
  const { settings, scheduleType, effectiveConfig, bookingMode, assignType, waitWindowMinutes } = resolvedConfig;
  const locationClusterIds = Array.from(new Set((input.locationClusterIds || []).filter(Boolean)));
  const requiredClusterIds = locationClusterIds.length ? locationClusterIds : [input.clusterId];
  const uniqueRequiredClusterIds = Array.from(new Set(requiredClusterIds));
  const requiredClusterId = uniqueRequiredClusterIds[0] || input.clusterId;
  const hasClusterMismatch = uniqueRequiredClusterIds.length > 1;
  const durationMinutes = Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30))));
  const now = new Date();
  const resolvedBookingEngineRule = await resolveBookingEngineRuleForContext({
    clusterId: requiredClusterId,
    categoryId: input.categoryId ?? null
  });
  const isServiceOpenByEngine = bookingEngineRuleOpen(resolvedBookingEngineRule, now);
  const engineAssignmentMode = resolvedBookingEngineRule?.assistantAssignmentMode === "auto" ? "auto" : resolvedBookingEngineRule?.assistantAssignmentMode === "manual" ? "manual" : (assignType === "automate" ? "auto" : "manual");
  const instantEtaMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantEtaMinutes ?? engineSettings.instantAutoMaxWaitMinutes ?? 45)));
  const instantWrapUpMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantWrapUpMinutes ?? 0)));
  const instantTravelMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantTravelMinutes ?? 0)));
  const scheduleEtaMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleEtaMinutes ?? 0)));
  const scheduleWrapUpMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleWrapUpMinutes ?? 0)));
  const scheduleTravelMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleTravelMinutes ?? 0)));

  const assistants = await pool.query<{
    assistantId: string;
    statusCode: string;
    latitude: number | null;
    longitude: number | null;
    busyFreeAt: Date | null;
    futureScheduledCount: number;
  }>(
    `
      select
        a.id as "assistantId",
        lower(coalesce(av.status_code, 'offline')) as "statusCode",
        av.latitude,
        av.longitude,
        active_work."busyFreeAt" as "busyFreeAt",
        coalesce(future_schedule."futureScheduledCount", 0)::int as "futureScheduledCount"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      left join zigo.assistant_cluster_map acm
        on acm.assistant_id = a.id
       and coalesce(acm.is_active, true) = true
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join lateral (
        select max(coalesce(
          sr.booking_available_at,
          nullif(sr.metadata->>'bookingAvailableAt', '')::timestamptz,
          nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz,
          sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
        )) as "busyFreeAt"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType', 'instant') <> 'schedule'
      ) active_work on true
      left join lateral (
        select count(*) as "futureScheduledCount"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date) >= current_date
      ) future_schedule on true
      where u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (a.current_cluster_id = $1 or acm.cluster_id = $1)
      group by a.id, av.status_code, av.latitude, av.longitude, active_work."busyFreeAt", future_schedule."futureScheduledCount"
    `,
    [requiredClusterId]
  );

  const assistantPool = hasClusterMismatch
    ? []
    : assistants.rows
      .filter((assistant) => assistantOnlineStatusCodes.has(assistant.statusCode))
      .map((assistant) => ({ ...assistant, nextAvailableAt: assistant.busyFreeAt && assistant.busyFreeAt.getTime() > now.getTime() ? assistant.busyFreeAt : now }));
  const scheduledByAssistant = new Map<string, Array<{ start: Date; end: Date }>>();
  if (assistantPool.length) {
    const activeSchedule = await pool.query<{ assistantId: string; startAt: Date | null; endAt: Date | null; scheduledDate: string | null; scheduledTime: string | null; durationMinutes: number }>(
      `
        select
          ta.assistant_id as "assistantId",
          coalesce(
            sr.booking_start_at,
            sr.scheduled_at,
            nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time
          ) as "startAt",
          coalesce(
            sr.booking_available_at,
            nullif(sr.metadata->>'bookingAvailableAt', '')::timestamptz,
            nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz,
            sr.booking_end_at,
            sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
            (nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
          ) as "endAt",
          sr.metadata->>'scheduledDate' as "scheduledDate",
          sr.metadata->>'scheduledTime' as "scheduledTime",
          coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = any($1::uuid[])
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date) >= $2::date
      `,
      [assistantPool.map((assistant) => assistant.assistantId), localDateText(new Date())]
    );
    for (const row of activeSchedule.rows) {
      const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
      if (!start) continue;
      const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
      if (end.getTime() <= Date.now()) continue;
      if (!scheduledByAssistant.has(row.assistantId)) scheduledByAssistant.set(row.assistantId, []);
      scheduledByAssistant.get(row.assistantId)!.push({ start, end });
    }
  }
  const onlineFreeAssistantCount = assistantPool.filter((assistant) => {
    if (assistant.nextAvailableAt.getTime() > now.getTime()) return false;
    const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
    return !scheduled.some((window) => window.start.getTime() <= now.getTime() && window.end.getTime() > now.getTime());
  }).length;
  const onlineAssistantCount = assistantPool.length;
  const workingAssistantCount = Math.max(0, onlineAssistantCount - onlineFreeAssistantCount);
  const configuredWaitWindowMinutes = waitWindowMinutes;
  const instantStartAt = now;
  const instantLimitMinutes = instantEtaMinutes || engineSettings.instantAutoMaxWaitMinutes || 45;
  const instantEndAt = new Date(instantStartAt.getTime() + durationMinutes * 60_000);
  const searchLatestStartAt = new Date(instantStartAt.getTime() + 7 * 24 * 60 * 60_000);
  const candidates = assistantPool
    .map((assistant) => {
      const predictedReadyAt = assistant.nextAvailableAt.getTime() > now.getTime()
        ? addMinutes(assistant.nextAvailableAt, instantWrapUpMinutes + instantTravelMinutes)
        : addMinutes(now, instantTravelMinutes);
      const window = nextOpenCapacityWindow({
        slotStart: instantStartAt,
        slotEnd: instantEndAt,
        baseAvailableAt: predictedReadyAt,
        latestStartAt: searchLatestStartAt,
        durationMinutes,
        scheduledWindows: scheduledByAssistant.get(assistant.assistantId) || []
      });
      const candidateStartAt = window?.candidateStartAt ?? null;
      const baseStartAt = candidateStartAt ?? predictedReadyAt;
      const availableInMinutes = minutesUntil(now, candidateStartAt);
      const fallbackAvailableInMinutes = minutesUntil(now, baseStartAt) ?? 0;
      return {
        ...assistant,
        predictedReadyAt,
        candidateStartAt: baseStartAt,
        candidateEndAt: window?.candidateEndAt ?? null,
        hasInstantCapacityWindow: Boolean(window),
        estimatedReachMinutes: fallbackAvailableInMinutes,
        waitMinutes: window && availableInMinutes != null ? availableInMinutes : fallbackAvailableInMinutes,
        estimatedAssignMinutes: window && availableInMinutes != null ? availableInMinutes : fallbackAvailableInMinutes
      };
    });
  const bestCandidateSource = candidates.some((candidate) => candidate.hasInstantCapacityWindow)
    ? candidates.filter((candidate) => candidate.hasInstantCapacityWindow)
    : candidates;
  const bestCandidate = bestCandidateSource.sort((left, right) =>
    left.estimatedAssignMinutes - right.estimatedAssignMinutes ||
    left.candidateStartAt.getTime() - right.candidateStartAt.getTime() ||
    Number(left.futureScheduledCount || 0) - Number(right.futureScheduledCount || 0) ||
    left.assistantId.localeCompare(right.assistantId)
  )[0] ?? null;
  const assistantNextAvailableAt = bestCandidate?.candidateStartAt ?? null;
  const nextOnlineAssistantAvailableAt = assistantNextAvailableAt;
  const assistantAvailableInMinutes = bestCandidate ? Math.max(0, Math.ceil((bestCandidate.candidateStartAt.getTime() - now.getTime()) / 60_000)) : null;
  const finalAssistantAvailableAt = assistantNextAvailableAt ? new Date(assistantNextAvailableAt.getTime() + configuredWaitWindowMinutes * 60_000) : null;
  const finalAssistantAvailableInMinutes = assistantAvailableInMinutes == null ? null : assistantAvailableInMinutes + configuredWaitWindowMinutes;
  const hasInstantMode = bookingMode === "instant" || bookingMode === "both";
  const hasScheduleMode = bookingMode === "schedule" || bookingMode === "both";
  const instantAllowed = Boolean(
    hasInstantMode
    && isServiceOpenByEngine
    && !hasClusterMismatch
    && bestCandidate
    && bestCandidate.hasInstantCapacityWindow
    && bestCandidate.estimatedAssignMinutes <= instantLimitMinutes
  );
  const scheduleAllowed = Boolean(hasScheduleMode && isServiceOpenByEngine && !hasClusterMismatch && bestCandidate);

  const dates = scheduleDatesForConfig(scheduleType);
  const scheduleTimeSlots = (scheduleType.timeSlots || []).filter(Boolean).sort();
  const scheduleAvailableSlots: Array<{ date: string; time: string; availableAssistants: number }> = [];
  if (assistantPool.length && dates.length && scheduleTimeSlots.length) {
    const requestedDurationMinutes = durationMinutes;
    const blocked = await pool.query<{ assistantId: string; startAt: Date | null; endAt: Date | null; scheduledDate: string | null; scheduledTime: string | null; durationMinutes: number }>(
      `
        select distinct
          ta.assistant_id as "assistantId",
          coalesce(
            sr.booking_start_at,
            sr.scheduled_at,
            nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time
          ) as "startAt",
          coalesce(
            sr.booking_available_at,
            nullif(sr.metadata->>'bookingAvailableAt', '')::timestamptz,
            nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz,
            sr.booking_end_at,
            sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
            (nullif(sr.metadata->>'scheduledDate', '')::date + nullif(sr.metadata->>'scheduledTime', '')::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
          ) as "endAt",
          sr.metadata->>'scheduledDate' as "scheduledDate",
          sr.metadata->>'scheduledTime' as "scheduledTime",
          coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = any($1::uuid[])
          and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(sr.booking_date, nullif(sr.metadata->>'scheduledDate', '')::date, sr.scheduled_at::date)::text = any($2::text[])
      `,
      [assistantPool.map((assistant) => assistant.assistantId), dates.map((date) => date.value)]
    );
    const scheduledByAssistant = new Map<string, Array<{ start: Date; end: Date }>>();
    for (const row of blocked.rows) {
      const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
      if (!start) continue;
      const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
      if (!scheduledByAssistant.has(row.assistantId)) scheduledByAssistant.set(row.assistantId, []);
      scheduledByAssistant.get(row.assistantId)!.push({ start, end });
    }
    for (const date of dates) {
      for (const time of scheduleTimeSlots) {
        const slotStart = scheduleSlotDate(date.value, time);
        if (!slotStart) continue;
        if (slotStart.getTime() <= now.getTime()) continue;
        const slotEnd = new Date(slotStart.getTime() + requestedDurationMinutes * 60_000);
        const availableAssistants = assistantPool.filter((assistant) => {
          const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
          const predictedReadyAt = assistant.nextAvailableAt.getTime() > now.getTime()
            ? addMinutes(assistant.nextAvailableAt, scheduleWrapUpMinutes + scheduleTravelMinutes)
            : addMinutes(now, scheduleTravelMinutes);
          return Boolean(nextOpenCapacityWindow({
            slotStart,
            slotEnd,
            baseAvailableAt: predictedReadyAt,
            latestStartAt: slotStart,
            durationMinutes: requestedDurationMinutes,
            scheduledWindows: scheduled
          }));
        }).length;
        scheduleAvailableSlots.push({ date: date.value, time, availableAssistants });
      }
    }
  }
  const hasScheduleCapacity = scheduleAvailableSlots.some((slot) => Number(slot.availableAssistants || 0) > 0);
  const unavailableReason = hasClusterMismatch
    ? "multi_cluster_locations"
    : !isServiceOpenByEngine
      ? "service_closed"
      : !assistantPool.length
        ? "no_cluster_assistant"
        : !hasScheduleCapacity
          ? "no_schedule_slots"
          : null;

  const canonicalResult = {
    effectiveBookingType: bookingMode === "schedule" ? "schedule" : "instant",
    bookingTypeMode: bookingMode,
    assignType,
    instantMode: assignType,
    assignmentMode: engineAssignmentMode,
    resolvedBookingEngineRule,
    assistantNextAvailableAt: assistantNextAvailableAt?.toISOString() ?? null,
    assistantAvailableInMinutes,
    serviceWaitWindowMinutes: configuredWaitWindowMinutes,
    finalAssistantAvailableAt: finalAssistantAvailableAt?.toISOString() ?? null,
    finalAssistantAvailableInMinutes,
    earliestPredictedAvailableAt: assistantNextAvailableAt?.toISOString() ?? null,
    instantAllowed,
    scheduleAllowed: scheduleAllowed && hasScheduleCapacity,
    instantAvailable: instantAllowed,
    estimatedReachMinutes: bestCandidate?.estimatedReachMinutes ?? settings.averageReachMinutes,
    instantEstimatedAssignMinutes: bestCandidate?.estimatedAssignMinutes ?? null,
    instantWaitMinutes: bestCandidate?.waitMinutes ?? null,
    instantWaitLimitMinutes: instantLimitMinutes,
    availabilityControls: {
      instantEtaMinutes,
      instantWrapUpMinutes,
      instantTravelMinutes,
      scheduleEtaMinutes,
      scheduleWrapUpMinutes,
      scheduleTravelMinutes,
      serviceOpen: isServiceOpenByEngine
    },
    engine: engineSettings,
    scheduleDates: dates,
    scheduleTimeSlots,
    scheduleAvailableSlots,
    scheduleAvailabilityChecked: true,
    eligibleAssistantCount: assistantPool.length,
    onlineAssistantCount,
    onlineFreeAssistantCount,
    workingAssistantCount,
    nextOnlineAssistantAvailableAt: nextOnlineAssistantAvailableAt?.toISOString() ?? null,
    earliestAssistantAvailableAt: assistantNextAvailableAt?.toISOString() ?? null,
    unavailableReason,
    config: effectiveConfig,
    scheduleConfig: scheduleType,
    automation: settings
  };
  return canonicalResult;
}

type BookingRouteStop = {
  addressId: string | null;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  clusterId: string;
  clusterName: string;
  cityName: string;
  zoneName: string;
  source: string;
  sequence: number;
  isPrimary: boolean;
  locationType: string;
  metadata: Record<string, unknown>;
};

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringFromUnknown(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function booleanFromUnknown(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  if (typeof value === "number") return value === 1;
  return fallback;
}

function bookingRouteLocationType(index: number, total: number) {
  if (total <= 1) return "customer_selected";
  if (index === 0) return "start_point";
  if (index === total - 1) return "end_point";
  return "stop_point";
}

function bookingLocationStopsFromMetadata(
  metadata: Record<string, unknown> | undefined,
  fallback: { address: string; latitude?: number | null; longitude?: number | null }
) {
  const bookingLocations = recordFromUnknown(metadata?.bookingLocations);
  const rawStops = Array.isArray(bookingLocations?.stops) ? bookingLocations.stops : [];
  const stops = rawStops
    .map((rawStop, index): BookingRouteStop | null => {
      const stop = recordFromUnknown(rawStop);
      if (!stop) return null;
      const address = stringFromUnknown(stop.address, stringFromUnknown(stop.addressText, ""));
      if (!address) return null;
      const latitude = numberFromUnknown(stop.latitude);
      const longitude = numberFromUnknown(stop.longitude);
      const sequence = Math.max(1, Math.round(numberFromUnknown(stop.sequence) ?? index + 1));
      return {
        addressId: stringFromUnknown(stop.addressId, stringFromUnknown(stop.savedAddressId, "")) || null,
        label: stringFromUnknown(stop.label, index === 0 ? "Start point" : `Stop ${index}`),
        address,
        latitude,
        longitude,
        clusterId: stringFromUnknown(stop.clusterId),
        clusterName: stringFromUnknown(stop.clusterName),
        cityName: stringFromUnknown(stop.cityName),
        zoneName: stringFromUnknown(stop.zoneName),
        source: stringFromUnknown(stop.source, "customer_portal"),
        sequence,
        isPrimary: booleanFromUnknown(stop.isPrimary, index === 0),
        locationType: "customer_selected",
        metadata: {
          addressId: stringFromUnknown(stop.addressId, stringFromUnknown(stop.savedAddressId, "")) || null,
          label: stringFromUnknown(stop.label, index === 0 ? "Start point" : `Stop ${index}`),
          clusterId: stringFromUnknown(stop.clusterId),
          clusterName: stringFromUnknown(stop.clusterName),
          cityName: stringFromUnknown(stop.cityName),
          zoneName: stringFromUnknown(stop.zoneName),
          source: stringFromUnknown(stop.source, "customer_portal"),
          isPrimary: booleanFromUnknown(stop.isPrimary, index === 0)
        }
      };
    })
    .filter((stop): stop is BookingRouteStop => Boolean(stop))
    .sort((left, right) => left.sequence - right.sequence)
    .map((stop, index, allStops) => ({
      ...stop,
      sequence: index + 1,
      isPrimary: index === 0,
      locationType: bookingRouteLocationType(index, allStops.length),
      metadata: {
        ...stop.metadata,
        sequence: index + 1,
        isPrimary: index === 0,
        locationType: bookingRouteLocationType(index, allStops.length)
      }
    }));

  if (stops.length) return stops;

  return [{
    addressId: null,
    label: "Customer selected location",
    address: fallback.address,
    latitude: fallback.latitude ?? null,
    longitude: fallback.longitude ?? null,
    clusterId: "",
    clusterName: "",
    cityName: "",
    zoneName: "",
    source: "fallback",
    sequence: 1,
    isPrimary: true,
    locationType: "customer_selected",
    metadata: {
      createdByAdmin: true,
      source: "fallback",
      sequence: 1,
      isPrimary: true,
      locationType: "customer_selected"
    }
  }];
}

function bookingLocationsMetadata(metadata: Record<string, unknown> | undefined, stops: BookingRouteStop[]) {
  const current = recordFromUnknown(metadata?.bookingLocations) || {};
  return {
    ...current,
    mode: stops.length > 1 ? "multi" : stringFromUnknown(current.mode, "current"),
    selectedCount: stops.length,
    stops: stops.map((stop) => ({
      addressId: stop.addressId,
      label: stop.label,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      clusterId: stop.clusterId,
      clusterName: stop.clusterName,
      cityName: stop.cityName,
      zoneName: stop.zoneName,
      source: stop.source,
      sequence: stop.sequence,
      isPrimary: stop.isPrimary,
      locationType: stop.locationType
    }))
  };
}

function normalizeBookingCartItems(metadata: Record<string, unknown> | undefined) {
  const cartItems = Array.isArray(metadata?.cartItems) ? metadata?.cartItems as Array<Record<string, unknown>> : [];
  return cartItems.map((item) => ({
    serviceId: typeof item.serviceId === "string" ? item.serviceId : null,
    serviceName: typeof item.serviceName === "string" ? item.serviceName : null,
    categoryId: typeof item.categoryId === "string" ? item.categoryId : null,
    categoryName: typeof item.categoryName === "string" ? item.categoryName : null,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeName: typeof item.storeName === "string" ? item.storeName : null,
    itemType: typeof item.itemType === "string" ? item.itemType : null,
    basePricePaise: Math.max(0, Math.round(Number(item.basePrice || 0) * 100)),
    sellingPricePaise: Math.max(0, Math.round(Number(item.price || item.sellingPrice || 0) * 100)),
    durationMinutes: Math.max(1, Math.round(Number(item.durationMinutes || item.cartDurationMinutes || 30)))
  }));
}

function uploadDetailsFromMetadata(metadata: Record<string, unknown> | undefined) {
  const uploads = Array.isArray(metadata?.uploads) ? metadata?.uploads as Array<unknown> : [];
  return uploads.map((item) => {
    if (!item || typeof item !== "object") {
      return { url: String(item || ""), name: null, type: null };
    }
    const upload = item as Record<string, unknown>;
    return {
      url: typeof upload.url === "string" ? upload.url : typeof upload.previewUrl === "string" ? upload.previewUrl : "",
      name: typeof upload.name === "string" ? upload.name : null,
      type: typeof upload.type === "string" ? upload.type : null
    };
  }).filter((item) => Boolean(item.url));
}

export async function createBookingByAdmin(input: {
  customerId: string;
  serviceId?: string | null;
  clusterId: string;
  categoryId?: string | null;
  deliveryTypeId?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  estimatedAmountPaise: number;
  durationMinutes: number;
  metadata?: Record<string, unknown>;
  actorUserId: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    const customer = await client.query(
      `
        select c.id, u.display_name, u.phone, u.email::text as email, coalesce(u.metadata->>'accountStatus', 'active') as status
        from zigo.customers c
        join zigo.users u on u.id = c.user_id
        where c.id = $1 and u.deleted_at is null
      `,
      [input.customerId]
    );
    if (!customer.rows[0]) throw new HttpError(400, "Selected customer was not found.");
    if (customer.rows[0].status !== "active") throw new HttpError(400, `Customer "${customer.rows[0].display_name || input.customerId}" is not active. Activate the customer before creating booking.`);
    const serviceId = input.serviceId ?? (await getDefaultServiceId(client));
    if (!serviceId) throw new HttpError(400, "No active Service found. Create/activate a Service before creating booking.");
    const serviceRow = await client.query<{ id: string; name: string; code: string | null }>(
      `
        select id, name, code
        from zigo.services
        where id = $1
        limit 1
      `,
      [serviceId]
    );
    const primaryCategoryId = input.categoryId ?? null;
    const categoryRow = primaryCategoryId ? await client.query<{ id: string; name: string; code: string | null }>(
      `
        select id, name, code
        from zigo.categories
        where id = $1
        limit 1
      `,
      [primaryCategoryId]
    ) : { rows: [] as Array<{ id: string; name: string; code: string | null }> };
    const inputMetadata = input.metadata ?? {};
    const cartItems = normalizeBookingCartItems(inputMetadata);
    const cartItemsSellingPaise = Math.max(
      0,
      Math.round(cartItems.reduce((sum, item) => sum + Number(item.sellingPricePaise || 0), 0))
    );
    const bookingMasterPricing = isBookingMasterMetadata(inputMetadata)
      ? await buildBookingMasterPriceQuote({
        metadata: inputMetadata,
        clusterId: input.clusterId,
        serviceId,
        categoryId: input.categoryId ?? null,
        durationMinutes: input.durationMinutes
      })
      : null;
    const pricingBreakdown = bookingMasterPricing ? null : await calculateClusterCategoryPricing(client, { clusterId: input.clusterId, categoryId: input.categoryId });
    const estimatedAmountPaise = bookingMasterPricing?.grandTotalPaise
      ?? (cartItemsSellingPaise > 0 ? cartItemsSellingPaise : null)
      ?? pricingBreakdown?.finalTotalAmountPaise
      ?? Math.max(0, Math.round(Number(input.estimatedAmountPaise || 0)));
    const requestNumber = `ADM-${Date.now()}`;
    const bookingTypeMode = inputMetadata.bookingType === "schedule" ? "schedule" : "instant";
    const isScheduleBooking = bookingTypeMode === "schedule";
    const normalizedDurationMinutes = Math.max(1, Math.min(1440, Math.round(Number(input.durationMinutes || 30))));
    const bookingEngineCategoryId = primaryCategoryId ?? cartItems[0]?.categoryId ?? null;
    const resolvedAvailabilityConfig = await resolveBookingAvailabilityConfig(client, {
      clusterId: input.clusterId,
      serviceId,
      categoryId: bookingEngineCategoryId
    });
    const engineSettings = await getBookingEngineSetting(client);
    const resolvedBookingEngineRule = await resolveBookingEngineRuleForContext({
      clusterId: input.clusterId,
      categoryId: bookingEngineCategoryId
    });
    const bookingEngineTiming = isScheduleBooking
      ? {
        etaMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleEtaMinutes ?? 0))),
        wrapUpMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleWrapUpMinutes ?? 0))),
        travelBufferMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleTravelMinutes ?? 0)))
      }
      : {
        etaMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantEtaMinutes ?? engineSettings.instantAutoMaxWaitMinutes ?? 0))),
        wrapUpMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantWrapUpMinutes ?? 0))),
        travelBufferMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantTravelMinutes ?? 0)))
      };
    const assignmentMode = resolvedAvailabilityConfig.assignType;
    const scheduledDate = typeof inputMetadata.scheduledDate === "string" ? inputMetadata.scheduledDate : "";
    const scheduledTime = typeof inputMetadata.scheduledTime === "string" ? inputMetadata.scheduledTime : "";
    const instantStartAt = new Date();
    const instantFreeAt = addMinutes(instantStartAt, normalizedDurationMinutes);
    const scheduledFreeAt = isScheduleBooking ? scheduleSlotEnd(scheduledDate, scheduledTime, normalizedDurationMinutes) : null;
    if (isScheduleBooking && !scheduledFreeAt) throw new HttpError(400, "Select a valid schedule date and time.");
    const requestedWaitWindowMinutes = resolvedAvailabilityConfig.waitWindowMinutes;
    const instantWaitLimitMinutes = bookingEngineTiming.etaMinutes || engineSettings.instantAutoMaxWaitMinutes || 45;
    const latestInstantStartAt = new Date(instantStartAt.getTime() + Math.max(0, instantWaitLimitMinutes - requestedWaitWindowMinutes) * 60_000);
    const requestLocationStops = bookingLocationStopsFromMetadata(inputMetadata, {
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null
    });
    const basePricePaise = Math.max(
      0,
      Math.round(
        cartItems.reduce((sum, item) => sum + Number(item.basePricePaise || 0), 0)
        || (pricingBreakdown?.baseAmount || 0) * 100
      )
    );
    const discountPaise = Math.max(
      0,
      Math.round(
        (cartItems.reduce((sum, item) => sum + Math.max(0, item.basePricePaise - item.sellingPricePaise), 0))
        || (pricingBreakdown?.discountAmount || 0) * 100
      )
    );
    const sellingPricePaise = Math.max(
      0,
      Math.round(
        cartItems.reduce((sum, item) => sum + Number(item.sellingPricePaise || 0), 0)
        || (pricingBreakdown?.sellingAmount || 0) * 100
      )
    );
    const paymentType = String(inputMetadata.paymentType || "cash").toLowerCase();
    const paymentStatus = String(inputMetadata.paymentStatus || (paymentType === "cash" ? "due" : "due")).toLowerCase();
    const isPaid = paymentStatus === "paid" || paymentStatus === "success" || paymentStatus === "captured" || paymentStatus === "completed";
    const paymentAmountPaise = Math.max(0, Math.round(Number(input.estimatedAmountPaise || estimatedAmountPaise || 0)));
    const bookingAt = instantStartAt;
    const bookingDate = isScheduleBooking ? scheduledDate : localDateText(bookingAt);
    const bookingTimeSlot = isScheduleBooking ? scheduledTime : localTimeText(bookingAt);
    const bookingPaymentDetails = {
      paymentType,
      paymentStatus: isPaid ? "paid" : paymentStatus,
      isPaid,
      amountPaise: paymentAmountPaise,
      basePricePaise,
      discountPaise,
      sellingPricePaise,
      waitingTimeMinutes: requestedWaitWindowMinutes,
      waitingChargesPaise: Math.max(0, Number(inputMetadata.waitingChargesPaise || 0))
    };
    const bookingServiceDetails = {
      serviceId: serviceRow.rows[0]?.id || serviceId,
      serviceName: serviceRow.rows[0]?.name || inputMetadata.serviceName || "Service",
      serviceCode: serviceRow.rows[0]?.code || null,
      items: cartItems.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        itemType: item.itemType,
        durationMinutes: item.durationMinutes,
        basePricePaise: item.basePricePaise,
        sellingPricePaise: item.sellingPricePaise
      }))
    };
    const bookingCategoryDetails = {
      categoryId: primaryCategoryId ?? cartItems[0]?.categoryId ?? null,
      categoryName: categoryRow.rows[0]?.name || cartItems[0]?.categoryName || inputMetadata.categoryName || null,
      categoryCode: categoryRow.rows[0]?.code || null,
      items: cartItems.map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        durationMinutes: item.durationMinutes,
        basePricePaise: item.basePricePaise,
        sellingPricePaise: item.sellingPricePaise
      }))
    };
    const bookingStoreDetails = cartItems.filter((item) => item.itemType === "store").map((item) => ({
      storeId: item.storeId,
      storeName: item.storeName,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      basePricePaise: item.basePricePaise,
      sellingPricePaise: item.sellingPricePaise,
      durationMinutes: item.durationMinutes
    }));
    const bookingCustomerDetails = {
      customerId: customer.rows[0].id,
      customerName: customer.rows[0].display_name || null,
      customerPhone: customer.rows[0].phone || null,
      customerEmail: customer.rows[0].email || null
    };
    const nextAssistantForSelectedCluster = await selectAssistantForCapacityWindow(client, {
      clusterId: input.clusterId,
      slotStart: instantStartAt,
      slotEnd: instantFreeAt,
      scheduledDate: localDateText(instantStartAt),
      latestStartAt: new Date(instantStartAt.getTime() + 7 * 24 * 60 * 60_000),
      durationMinutes: normalizedDurationMinutes
    });
    const scheduledSlotStart = isScheduleBooking ? scheduleSlotDate(scheduledDate, scheduledTime) : null;
    const selectedAssistant = isScheduleBooking
      ? await selectScheduleAssistantForSlot(client, {
        clusterId: input.clusterId,
        scheduledDate,
        scheduledTime,
        durationMinutes: normalizedDurationMinutes
      })
      : await selectAssistantForCapacityWindow(client, {
        clusterId: input.clusterId,
        slotStart: instantStartAt,
        slotEnd: instantFreeAt,
        scheduledDate: localDateText(instantStartAt),
        latestStartAt: latestInstantStartAt,
        durationMinutes: normalizedDurationMinutes
      });
    if (!selectedAssistant) {
      if (!isScheduleBooking) {
        const nextAssistant = await selectAssistantForCapacityWindow(client, {
          clusterId: input.clusterId,
          slotStart: instantStartAt,
          slotEnd: instantFreeAt,
          scheduledDate: localDateText(instantStartAt),
          latestStartAt: new Date(instantStartAt.getTime() + 7 * 24 * 60 * 60_000),
          durationMinutes: normalizedDurationMinutes
        });
        if (nextAssistant?.candidateStartAt) {
          const availableInMinutes = Math.max(0, Math.ceil((nextAssistant.candidateStartAt.getTime() - instantStartAt.getTime()) / 60_000));
          const totalMinutes = availableInMinutes + requestedWaitWindowMinutes;
          const parts = [`Assistant will be available in ${shortDurationLabel(totalMinutes)}.`];
          if (availableInMinutes > 0) {
            parts.push(`Next availability ${shortDurationLabel(availableInMinutes)} + service wait window ${shortDurationLabel(requestedWaitWindowMinutes)}.`);
          } else {
            parts.push(`Service wait window ${shortDurationLabel(requestedWaitWindowMinutes)}.`);
          }
          parts.push("To wait so much time, please go with schedule booking.");
          throw new HttpError(409, parts.join(" "));
        }
      }
      throw new HttpError(409, isScheduleBooking ? "Selected schedule slot is no longer available." : "No online assistant capacity is available for instant booking.");
    }
    const assignmentStartAt = isScheduleBooking
      ? scheduleSlotDate(scheduledDate, scheduledTime)
      : selectedAssistant.candidateStartAt ?? instantStartAt;
    if (!assignmentStartAt) throw new HttpError(400, "Booking start time is invalid.");
    const bookingWorkEndAt = addMinutes(assignmentStartAt, normalizedDurationMinutes);
    const bookingAvailableAt = addMinutes(bookingWorkEndAt, bookingEngineTiming.wrapUpMinutes + bookingEngineTiming.travelBufferMinutes);
    const expectedFreeAt = bookingAvailableAt;
    const instantAssignWaitMinutes = isScheduleBooking ? 0 : Math.max(0, Math.ceil((assignmentStartAt.getTime() - instantStartAt.getTime()) / 60_000)) + requestedWaitWindowMinutes;
    const serviceScheduledAt = isScheduleBooking ? assignmentStartAt : null;
    const requestMetadata = {
      createdByAdmin: true,
      actorUserId: input.actorUserId,
      ...(pricingBreakdown ? { pricingBreakdown } : {}),
      ...inputMetadata,
      bookingLocations: bookingLocationsMetadata(inputMetadata, requestLocationStops),
      bookingType: bookingTypeMode,
      assignmentMode,
      ...(assignmentMode === "automate" && !isScheduleBooking ? { instantAssignWaitMinutes, instantWaitLimitMinutes } : {}),
      bookingStartAt: assignmentStartAt.toISOString(),
      bookingEndAt: bookingWorkEndAt.toISOString(),
      bookingAvailableAt: bookingAvailableAt.toISOString(),
      taskEndAt: bookingWorkEndAt.toISOString(),
      expectedFreeAt: expectedFreeAt.toISOString(),
      etaMinutes: bookingEngineTiming.etaMinutes,
      wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
      travelBufferMinutes: bookingEngineTiming.travelBufferMinutes,
      resolvedBookingEngineRule,
      ...(bookingMasterPricing ? { priceMasterQuote: bookingMasterPricing, priceMasterQuoteRecomputed: true } : {})
    };
    const initialStatusCode = assignmentMode === "automate" ? "assigned" : "payment_pending";

    const request = await client.query<{ id: string }>(
      `
        insert into zigo.service_requests
          (request_number, booking_at, booking_type, booking_date, booking_time_slot,
           scheduled_at,
           customer_id, customer_details,
           service_id, service_details, category_id, category_details, store_details,
           cluster_id, delivery_type_id,
           status_code, notes, additional_details,
           duration_minutes, booking_amount_paise, estimated_amount_paise,
           base_price_paise, discount_paise, selling_price_paise,
           waiting_time_minutes, waiting_charges_paise,
           payment_type, payment_status, is_paid, payment_details,
           location_details, upload_details,
           currency, metadata)
        values ($1, now(), $2, $3, $4,
          $5,
          $6, $7::jsonb,
          $8, $9::jsonb, $10, $11::jsonb, $12::jsonb,
          $13, $14,
          $15, $16, $17::jsonb,
          $18, $19, $20,
          $21, $22, $23,
          $24, $25,
          $26, $27, $28, $29::jsonb,
          $30::jsonb, $31::jsonb,
          'INR', $32::jsonb)
        returning id
      `,
      [
        requestNumber,
        bookingTypeMode,
        bookingDate,
        bookingTimeSlot,
        serviceScheduledAt,
        input.customerId,
        JSON.stringify(bookingCustomerDetails),
        serviceId,
        JSON.stringify(bookingServiceDetails),
        primaryCategoryId,
        JSON.stringify(bookingCategoryDetails),
        JSON.stringify(bookingStoreDetails),
        input.clusterId,
        input.deliveryTypeId ?? null,
        initialStatusCode,
        input.notes ?? null,
        JSON.stringify({
          createdFrom: "customer_portal",
          note: input.notes ?? null,
          customerNote: inputMetadata.customerNote || "",
          bookingType: bookingTypeMode,
          assignmentMode,
          scheduledDate: isScheduleBooking ? scheduledDate : null,
          scheduledTime: isScheduleBooking ? scheduledTime : null,
          scheduledAt: isScheduleBooking ? assignmentStartAt.toISOString() : null,
          bookingStartAt: assignmentStartAt.toISOString(),
          bookingEndAt: bookingWorkEndAt.toISOString(),
          bookingAvailableAt: bookingAvailableAt.toISOString(),
          taskEndAt: bookingWorkEndAt.toISOString(),
          etaMinutes: bookingEngineTiming.etaMinutes,
          wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
          travelBufferMinutes: bookingEngineTiming.travelBufferMinutes,
          waitWindowMinutes: requestedWaitWindowMinutes,
          waitWindowNote: inputMetadata.waitWindowNote || "",
          bookingLocations: bookingLocationsMetadata(inputMetadata, requestLocationStops),
          serviceBookingTypes: inputMetadata.serviceBookingTypes || [],
          serviceName: serviceRow.rows[0]?.name || inputMetadata.serviceName || null,
          categoryName: categoryRow.rows[0]?.name || inputMetadata.categoryName || null,
          selectedLocation: inputMetadata.selectedLocation || null,
          selectedPayment: inputMetadata.paymentType || "cash"
        }),
        normalizedDurationMinutes,
        paymentAmountPaise,
        estimatedAmountPaise,
        basePricePaise,
        discountPaise,
        sellingPricePaise,
        requestedWaitWindowMinutes,
        Math.max(0, Number(inputMetadata.waitingChargesPaise || 0)),
        paymentType,
        paymentStatus,
        isPaid,
        JSON.stringify(bookingPaymentDetails),
        JSON.stringify(requestLocationStops),
        JSON.stringify(uploadDetailsFromMetadata(inputMetadata)),
        JSON.stringify(requestMetadata)
      ]
    );

    await client.query(
      `
        update zigo.service_requests
        set booking_start_at = $2,
            booking_end_at = $3,
            booking_available_at = $4,
            eta_minutes = $5,
            wrap_up_minutes = $6,
            travel_buffer_minutes = $7,
            updated_at = now()
        where id = $1
      `,
      [
        request.rows[0].id,
        assignmentStartAt,
        bookingWorkEndAt,
        bookingAvailableAt,
        bookingEngineTiming.etaMinutes,
        bookingEngineTiming.wrapUpMinutes,
        bookingEngineTiming.travelBufferMinutes
      ]
    );

    for (const stop of requestLocationStops) {
      await client.query(
        `
          insert into zigo.request_locations
            (service_request_id, sequence, location_type, name, address, latitude, longitude, metadata)
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          request.rows[0].id,
          stop.sequence,
          stop.locationType,
          stop.label,
          stop.address,
          stop.latitude,
          stop.longitude,
          JSON.stringify({ ...stop.metadata, createdByAdmin: true })
        ]
      );
    }

    let capacityAssignment: { id: string; assistantId: string; statusCode: string } | null = null;
    const capacityStatusCode = assignmentMode === "automate" ? "offered" : "reserved";
    const capacitySource = assignmentMode === "automate" ? "booking_auto_assignment" : "booking_capacity_reservation";
    const capacitySlotStart = assignmentStartAt;
    const capacityExpiresAt = expectedFreeAt;
    if (!capacityExpiresAt) throw new HttpError(400, "Booking start time is invalid.");
      const assignment = await client.query<{ id: string }>(
        `
          insert into zigo.task_assignments
            (request_id, service_request_id, assistant_id, status_code, expires_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
          values ($1, $1, $2, $3, $4, $5, $6, $6, $7::jsonb)
          returning id
        `,
        [
          request.rows[0].id,
          selectedAssistant.assistantId,
          capacityStatusCode,
          capacityExpiresAt,
          assignmentMode === "automate" ? "Automatic booking assignment" : "Booking capacity reserved for manual assignment",
          input.actorUserId,
          JSON.stringify({
            source: capacitySource,
            bookingType: bookingTypeMode,
            assignmentMode,
            scheduledDate: isScheduleBooking ? scheduledDate : localDateText(assignmentStartAt),
            scheduledTime: isScheduleBooking ? scheduledTime : localTimeText(assignmentStartAt),
            startsAt: assignmentStartAt.toISOString(),
            taskEndAt: bookingWorkEndAt.toISOString(),
            bookingAvailableAt: bookingAvailableAt.toISOString(),
            expectedFreeAt: expectedFreeAt?.toISOString(),
            etaMinutes: bookingEngineTiming.etaMinutes,
            wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
            travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
          })
        ]
      );
      capacityAssignment = { id: assignment.rows[0].id, assistantId: selectedAssistant.assistantId, statusCode: capacityStatusCode };
      const promisedStartAt = isScheduleBooking
        ? assignmentStartAt
        : new Date(assignmentStartAt.getTime() + requestedWaitWindowMinutes * 60_000);
      const slaDeadlineAt = new Date(promisedStartAt.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
      const reservation = await upsertCapacityReservation(client, {
        serviceRequestId: request.rows[0].id,
        assignmentId: assignment.rows[0].id,
        assistantId: selectedAssistant.assistantId,
        clusterId: input.clusterId,
        bookingType: bookingTypeMode,
        assignType: assignmentMode,
        statusCode: assignmentMode === "automate" ? "assigned" : "reserved",
        reservedFrom: assignmentStartAt,
        reservedUntil: expectedFreeAt!,
        promisedStartAt,
        slaDeadlineAt,
        source: capacitySource,
        actorUserId: input.actorUserId,
        metadata: {
          taskAssignmentStatus: capacityStatusCode,
          scheduledDate: isScheduleBooking ? scheduledDate : localDateText(assignmentStartAt),
          scheduledTime: isScheduleBooking ? scheduledTime : localTimeText(assignmentStartAt),
          waitWindowMinutes: requestedWaitWindowMinutes,
          durationMinutes: normalizedDurationMinutes,
          taskEndAt: bookingWorkEndAt.toISOString(),
          bookingAvailableAt: bookingAvailableAt.toISOString(),
          expectedFreeAt: expectedFreeAt.toISOString(),
          etaMinutes: bookingEngineTiming.etaMinutes,
          wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
          travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
        }
      });
      await client.query(
        `
          update zigo.service_requests
          set accepted_assignment_id = case when $5::boolean then $2 else accepted_assignment_id end,
              metadata = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(coalesce(metadata, '{}'::jsonb), '{expectedFreeAt}', to_jsonb($3::text), true),
                    '{promisedStartAt}', to_jsonb($4::text), true
                  ),
                  '{slaDeadlineAt}', to_jsonb($6::text), true
                ),
                '{capacityReservationId}', to_jsonb($7::text), true
              )
          where id = $1
        `,
        [
          request.rows[0].id,
          assignment.rows[0].id,
          expectedFreeAt!.toISOString(),
          promisedStartAt.toISOString(),
          assignmentMode === "automate",
          slaDeadlineAt.toISOString(),
          reservation.id
        ]
      );
      await upsertBookingOrchestrationState(client, {
        serviceRequestId: request.rows[0].id,
        clusterId: input.clusterId,
        demandStatus: bookingDemandStatusFor(initialStatusCode),
        riskStatus: "on_time",
        supplyStatus: bookingSupplyStatusFor({ assignmentMode, assistantId: selectedAssistant.assistantId, bookingType: bookingTypeMode }),
        bookingType: bookingTypeMode,
        assignType: assignmentMode,
        requestedStartAt: assignmentStartAt,
        promisedStartAt,
        slaDeadlineAt,
        assistantId: selectedAssistant.assistantId,
        reservationId: reservation.id,
        nextCheckAt: new Date(Math.max(Date.now(), promisedStartAt.getTime() - Math.max(1, engineSettings.riskLookaheadMinutes || 15) * 60_000)),
        lastEventType: "booking.created",
        metadata: {
          assignmentId: assignment.rows[0].id,
          taskAssignmentStatus: capacityStatusCode,
          waitWindowMinutes: requestedWaitWindowMinutes,
          durationMinutes: normalizedDurationMinutes,
          taskEndAt: bookingWorkEndAt.toISOString(),
          bookingAvailableAt: bookingAvailableAt.toISOString(),
          expectedFreeAt: expectedFreeAt.toISOString(),
          etaMinutes: bookingEngineTiming.etaMinutes,
          wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
          travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
        }
      });

    await writeAdminAction(client, input.actorUserId, request.rows[0].id, "create_booking", "Booking created on behalf of customer", {
      customerId: input.customerId,
      clusterId: input.clusterId,
      assignmentMode,
      bookingType: bookingTypeMode,
      ...(capacityAssignment ? { reservedAssistantId: capacityAssignment.assistantId, capacityAssignmentId: capacityAssignment.id, capacityStatusCode: capacityAssignment.statusCode } : {})
    });

    await client.query("commit");
    return request.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBookingPriceQuote(input: { clusterId: string; categoryId?: string | null }) {
  return calculateClusterCategoryPricing(pool, input);
}

function isBookingMasterMetadata(metadata: Record<string, unknown> | undefined): metadata is Record<string, unknown> {
  return Boolean(metadata && metadata.bookingMaster === true);
}

async function buildBookingMasterPriceQuote(input: {
  metadata: Record<string, unknown>;
  clusterId: string;
  serviceId: string;
  categoryId?: string | null;
  durationMinutes: number;
}) {
  const cartItems = normalizeBookingMasterCartItems(input.metadata.cartItems);
  const priceType = input.metadata.priceType === "time" && !cartItems.length ? "time" : "task";
  const quote = await quotePriceMaster({
    priceType,
    clusterId: input.clusterId,
    serviceId: input.serviceId,
    categoryId: input.categoryId ?? null,
    durationMinutes: Number(input.metadata.durationMinutes ?? input.durationMinutes ?? 30),
    cartItems
  });
  if (!quote.isValid) {
    const message = quote.errors?.length ? quote.errors.join(" ") : "Price Master quote is invalid.";
    throw new HttpError(400, message);
  }
  return quote;
}

function normalizeBookingMasterCartItems(value: unknown): Array<{ serviceId?: string; categoryId?: string | null; storeId?: string | null; priceType?: "task" | "time"; durationMinutes?: number | null }> {
  if (!Array.isArray(value)) return [];
  const cartItems: Array<{ serviceId?: string; categoryId?: string | null; storeId?: string | null; priceType?: "task" | "time"; durationMinutes?: number | null }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const priceType = row.priceType === "time" ? "time" : "task";
    const categoryId = typeof row.categoryId === "string" && row.categoryId ? row.categoryId : null;
    if (!categoryId && priceType !== "time") continue;
    cartItems.push({
      serviceId: typeof row.serviceId === "string" ? row.serviceId : undefined,
      categoryId,
      storeId: typeof row.storeId === "string" ? row.storeId : null,
      priceType,
      durationMinutes: row.durationMinutes == null ? null : Number(row.durationMinutes)
    });
  }
  return cartItems;
}

export async function listLiveOperations() {
  const result = await pool.query(
    `
      select
        sr.id,
        sr.status_code as "statusCode",
        sr.cluster_id as "clusterId",
        sr.estimated_amount_paise as "estimatedAmountPaise",
        sr.currency,
        sr.created_at as "createdAt",
        c.customer_code as "customerCode",
        ta.id as "assignmentId",
        ta.status_code as "assignmentStatus",
        a.id as "assistantId",
        a.assistant_code as "assistantCode",
        lp.latitude as "assistantLatitude",
        lp.longitude as "assistantLongitude",
        lp.created_at as "lastPingAt"
      from zigo.service_requests sr
      left join zigo.customers c on c.id = sr.customer_id
      left join lateral (
        select *
        from zigo.task_assignments latest_ta
        where latest_ta.service_request_id = sr.id or latest_ta.request_id = sr.id
        order by latest_ta.offered_at desc, latest_ta.assigned_at desc
        limit 1
      ) ta on true
      left join zigo.assistants a on a.id = ta.assistant_id
      left join lateral (
        select latitude, longitude, created_at
        from zigo.assistant_location_pings
        where service_request_id = sr.id
        order by created_at desc
        limit 1
      ) lp on true
      where sr.status_code in ('queued', 'assigned', 'accepted', 'in_progress', 'approval_pending', 'failed', 'cancelled')
      order by sr.created_at desc
      limit 200
    `
  );
  return result.rows;
}

async function ensureAssistantAvailableForBookingAssignment(db: Queryable, input: {
  serviceRequestId: string;
  assistantId: string;
  forceMultiTaskAssignment?: boolean;
}) {
  const booking = await db.query<{
    id: string;
    clusterId: string;
    metadata: Record<string, unknown>;
    durationMinutes: number;
    createdAt: Date;
    bookingStartAt: Date | null;
    bookingEndAt: Date | null;
    bookingAvailableAt: Date | null;
  }>(
    `
      select
        id,
        cluster_id as "clusterId",
        coalesce(metadata, '{}'::jsonb) as metadata,
        coalesce(duration_minutes, 30)::int as "durationMinutes",
        created_at as "createdAt",
        booking_start_at as "bookingStartAt",
        booking_end_at as "bookingEndAt",
        booking_available_at as "bookingAvailableAt"
      from zigo.service_requests
      where id = $1
      for update
    `,
    [input.serviceRequestId]
  );
  const row = booking.rows[0];
  if (!row) throw new HttpError(404, "Booking not found.");

  const assistant = await db.query(
    `
      select a.id
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      where a.id = $1
        and u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (
          a.current_cluster_id = $2
          or exists (
            select 1
            from zigo.assistant_cluster_map acm
            where acm.assistant_id = a.id
              and acm.cluster_id = $2
              and coalesce(acm.is_active, true) = true
          )
        )
    `,
    [input.assistantId, row.clusterId]
  );
  if (!assistant.rows[0]) throw new HttpError(400, "Selected assistant is not active or not mapped with this booking cluster.");

  const durationMinutes = Math.max(1, Math.min(1440, Math.round(Number(row.durationMinutes || 30))));
  const bookingType = row.metadata?.bookingType === "schedule" ? "schedule" : "instant";
  const slotStart = row.bookingStartAt ?? (bookingType === "schedule"
    ? scheduleSlotDate(String(row.metadata.scheduledDate || ""), String(row.metadata.scheduledTime || ""))
    : new Date());
  if (!slotStart) throw new HttpError(400, "Booking schedule date/time is invalid.");
  const expectedFreeAtRaw = typeof row.metadata?.expectedFreeAt === "string" ? new Date(row.metadata.expectedFreeAt) : null;
  const slotEnd = row.bookingAvailableAt
    ?? (expectedFreeAtRaw && !Number.isNaN(expectedFreeAtRaw.getTime())
    ? expectedFreeAtRaw
    : row.bookingEndAt ?? new Date(slotStart.getTime() + durationMinutes * 60_000));

  const assignments = await db.query<{
    serviceRequestId: string;
    metadata: Record<string, unknown>;
    durationMinutes: number;
    createdAt: Date;
    bookingStartAt: Date | null;
    bookingEndAt: Date | null;
    bookingAvailableAt: Date | null;
  }>(
    `
      select
        sr.id as "serviceRequestId",
        coalesce(sr.metadata, '{}'::jsonb) as metadata,
        coalesce(sr.duration_minutes, 30)::int as "durationMinutes",
        sr.created_at as "createdAt",
        sr.booking_start_at as "bookingStartAt",
        sr.booking_end_at as "bookingEndAt",
        sr.booking_available_at as "bookingAvailableAt"
      from zigo.task_assignments ta
      join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
      where ta.assistant_id = $1
        and sr.id <> $2
        and ta.status_code in ('reserved', 'offered', 'accepted', 'in_progress')
        and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
    `,
    [input.assistantId, input.serviceRequestId]
  );
  const overlappingAssignments: Array<{
    serviceRequestId: string;
    startAt: string;
    expectedFreeAt: string;
  }> = [];

  for (const assignment of assignments.rows) {
    const otherDuration = Math.max(1, Math.min(1440, Math.round(Number(assignment.durationMinutes || 30))));
    const otherType = assignment.metadata?.bookingType === "schedule" ? "schedule" : "instant";
    const otherStart = assignment.bookingStartAt ?? (otherType === "schedule"
      ? scheduleSlotDate(String(assignment.metadata.scheduledDate || ""), String(assignment.metadata.scheduledTime || ""))
      : assignment.createdAt);
    if (!otherStart) continue;
    const otherExpectedFreeAt = typeof assignment.metadata?.expectedFreeAt === "string" ? new Date(assignment.metadata.expectedFreeAt) : null;
    const otherEnd = assignment.bookingAvailableAt
      ?? (otherExpectedFreeAt && !Number.isNaN(otherExpectedFreeAt.getTime())
      ? otherExpectedFreeAt
      : assignment.bookingEndAt ?? new Date(otherStart.getTime() + otherDuration * 60_000));
    if (slotStart < otherEnd && slotEnd > otherStart) {
      overlappingAssignments.push({
        serviceRequestId: assignment.serviceRequestId,
        startAt: otherStart.toISOString(),
        expectedFreeAt: otherEnd.toISOString()
      });
    }
  }

  if (overlappingAssignments.length && !input.forceMultiTaskAssignment) {
    throw new HttpError(
      409,
      "Assistant already has a task during this booking time. Confirm multi-task assignment to continue."
    );
  }

  return {
    slotStart,
    slotEnd,
    durationMinutes,
    clusterId: row.clusterId,
    bookingType,
    metadata: row.metadata,
    multiTaskOverride: Boolean(overlappingAssignments.length && input.forceMultiTaskAssignment),
    overlappingAssignments
  };
}

export async function assignBooking(input: {
  serviceRequestId: string;
  assistantId: string;
  actorUserId: string;
  reason: string;
  forceMultiTaskAssignment?: boolean;
}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    const engineSettings = await getBookingEngineSetting(client);
    const availability = await ensureAssistantAvailableForBookingAssignment(client, input);
    const slaDeadlineAt = new Date(availability.slotStart.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
    const nextCheckAt = new Date(Math.max(Date.now(), availability.slotStart.getTime() - Math.max(1, engineSettings.riskLookaheadMinutes || 15) * 60_000));
    const reserved = await client.query<{ id: string }>(
      `
        update zigo.task_assignments
        set status_code = 'offered',
            expires_at = $5,
            admin_reason = $3,
            assigned_by_user_id = $4,
            created_by_user_id = coalesce(created_by_user_id, $4),
            metadata = coalesce(metadata, '{}'::jsonb) || '{"source": "admin_panel_reserved_assignment"}'::jsonb
        where service_request_id = $1
          and assistant_id = $2
          and status_code = 'reserved'
        returning id
      `,
      [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]
    );
    const assignment = reserved.rows[0]
      ? reserved
      : await client.query<{ id: string }>(
        `
        insert into zigo.task_assignments
            (request_id, service_request_id, assistant_id, status_code, expires_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
          values ($1, $1, $2, 'offered', $5, $3, $4, $4, '{"source": "admin_panel"}'::jsonb)
          returning id
        `,
        [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]
      );
    await client.query(
      `
        update zigo.task_assignments
        set status_code = 'released',
            responded_at = now(),
            admin_reason = coalesce(admin_reason, 'Released during manual assignment')
        where service_request_id = $1
          and status_code = 'reserved'
          and id <> $2
      `,
      [input.serviceRequestId, assignment.rows[0].id]
    );
    const reservation = await upsertCapacityReservation(client, {
      serviceRequestId: input.serviceRequestId,
      assignmentId: assignment.rows[0].id,
      assistantId: input.assistantId,
      clusterId: availability.clusterId,
      bookingType: availability.bookingType,
      assignType: "manual",
      statusCode: "assigned",
      reservedFrom: availability.slotStart,
      reservedUntil: availability.slotEnd,
      promisedStartAt: availability.slotStart,
      slaDeadlineAt,
      source: "manual_assignment",
      actorUserId: input.actorUserId,
      metadata: {
        reason: input.reason,
        durationMinutes: availability.durationMinutes,
        multiTaskOverride: availability.multiTaskOverride,
        overlappingAssignments: availability.overlappingAssignments
      }
    });
    await releaseCapacityReservations(client, {
      serviceRequestId: input.serviceRequestId,
      exceptAssignmentId: assignment.rows[0].id,
      statusCode: "replaced",
      reason: "Manual assignment selected another assistant."
    });
    await client.query(
      `
        update zigo.service_requests
        set status_code = 'assigned',
            accepted_assignment_id = $2,
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(coalesce(metadata, '{}'::jsonb), '{expectedFreeAt}', to_jsonb($3::text), true),
                  '{promisedStartAt}', to_jsonb($4::text), true
                ),
                '{slaDeadlineAt}', to_jsonb($5::text), true
              ),
              '{capacityReservationId}', to_jsonb($6::text), true
            )
        where id = $1 and status_code in ('payment_pending', 'queued', 'paid', 'assigned', 'hold', 'on_hold')
      `,
      [
        input.serviceRequestId,
        assignment.rows[0].id,
        availability.slotEnd.toISOString(),
        availability.slotStart.toISOString(),
        slaDeadlineAt.toISOString(),
        reservation.id
      ]
    );
    await upsertBookingOrchestrationState(client, {
      serviceRequestId: input.serviceRequestId,
      clusterId: availability.clusterId,
      demandStatus: "assigned",
      riskStatus: "on_time",
      supplyStatus: "assigned",
      bookingType: availability.bookingType,
      assignType: "manual",
      requestedStartAt: availability.slotStart,
      promisedStartAt: availability.slotStart,
      slaDeadlineAt,
      assistantId: input.assistantId,
      reservationId: reservation.id,
      nextCheckAt,
      lastEventType: "booking.assigned",
      metadata: {
        assignmentId: assignment.rows[0].id,
        reason: input.reason,
        multiTaskOverride: availability.multiTaskOverride,
        overlappingAssignments: availability.overlappingAssignments
      }
    });
    await writeAdminAction(client, input.actorUserId, input.serviceRequestId, "assign", input.reason, {
      assistantId: input.assistantId,
      assignmentId: assignment.rows[0].id,
      multiTaskOverride: availability.multiTaskOverride,
      overlappingAssignments: availability.overlappingAssignments
    });
    await client.query("commit");
    return assignment.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function reassignBooking(input: {
  serviceRequestId: string;
  assistantId: string;
  actorUserId: string;
  reason: string;
  forceMultiTaskAssignment?: boolean;
}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    const engineSettings = await getBookingEngineSetting(client);
    const availability = await ensureAssistantAvailableForBookingAssignment(client, input);
    const slaDeadlineAt = new Date(availability.slotStart.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
    const nextCheckAt = new Date(Math.max(Date.now(), availability.slotStart.getTime() - Math.max(1, engineSettings.riskLookaheadMinutes || 15) * 60_000));
    await client.query(
      `
        update zigo.task_assignments
        set status_code = 'reassigned',
            admin_reason = $3,
            responded_at = now()
        where service_request_id = $1
          and status_code in ('offered', 'accepted')
          and assistant_id <> $2
      `,
      [input.serviceRequestId, input.assistantId, input.reason]
    );
    const assignment = await client.query<{ id: string }>(
      `
        insert into zigo.task_assignments
          (request_id, service_request_id, assistant_id, status_code, expires_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
        values ($1, $1, $2, 'offered', $5, $3, $4, $4, '{"source": "admin_panel"}'::jsonb)
        returning id
      `,
      [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]
    );
    await releaseCapacityReservations(client, {
      serviceRequestId: input.serviceRequestId,
      exceptAssignmentId: null,
      statusCode: "replaced",
      reason: "Booking reassigned to another assistant."
    });
    const reservation = await upsertCapacityReservation(client, {
      serviceRequestId: input.serviceRequestId,
      assignmentId: assignment.rows[0].id,
      assistantId: input.assistantId,
      clusterId: availability.clusterId,
      bookingType: availability.bookingType,
      assignType: "manual",
      statusCode: "assigned",
      reservedFrom: availability.slotStart,
      reservedUntil: availability.slotEnd,
      promisedStartAt: availability.slotStart,
      slaDeadlineAt,
      source: "manual_reassignment",
      actorUserId: input.actorUserId,
      metadata: {
        reason: input.reason,
        durationMinutes: availability.durationMinutes,
        multiTaskOverride: availability.multiTaskOverride,
        overlappingAssignments: availability.overlappingAssignments
      }
    });
    await client.query(
      `
        update zigo.service_requests
        set status_code = 'assigned',
            accepted_assignment_id = $2,
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(coalesce(metadata, '{}'::jsonb), '{expectedFreeAt}', to_jsonb($3::text), true),
                  '{promisedStartAt}', to_jsonb($4::text), true
                ),
                '{slaDeadlineAt}', to_jsonb($5::text), true
              ),
              '{capacityReservationId}', to_jsonb($6::text), true
            )
        where id = $1
      `,
      [
        input.serviceRequestId,
        assignment.rows[0].id,
        availability.slotEnd.toISOString(),
        availability.slotStart.toISOString(),
        slaDeadlineAt.toISOString(),
        reservation.id
      ]
    );
    await upsertBookingOrchestrationState(client, {
      serviceRequestId: input.serviceRequestId,
      clusterId: availability.clusterId,
      demandStatus: "assigned",
      riskStatus: "on_time",
      supplyStatus: "assigned",
      bookingType: availability.bookingType,
      assignType: "manual",
      requestedStartAt: availability.slotStart,
      promisedStartAt: availability.slotStart,
      slaDeadlineAt,
      assistantId: input.assistantId,
      reservationId: reservation.id,
      nextCheckAt,
      lastEventType: "booking.reassigned",
      metadata: {
        assignmentId: assignment.rows[0].id,
        reason: input.reason,
        multiTaskOverride: availability.multiTaskOverride,
        overlappingAssignments: availability.overlappingAssignments
      }
    });
    await writeAdminAction(client, input.actorUserId, input.serviceRequestId, "reassign", input.reason, {
      assistantId: input.assistantId,
      assignmentId: assignment.rows[0].id,
      multiTaskOverride: availability.multiTaskOverride,
      overlappingAssignments: availability.overlappingAssignments
    });
    await client.query("commit");
    return assignment.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getDefaultServiceId(client: Pick<typeof pool, "query">) {
  const result = await client.query<{ id: string }>(
    `
      select id
      from zigo.services
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
      order by sort_order, name
      limit 1
    `
  );
  return result.rows[0]?.id ?? null;
}

export async function cancelBookingByAdmin(serviceRequestId: string, actorUserId: string, reason: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    const result = await client.query<{ id: string; clusterId: string; metadata: Record<string, unknown> }>(
      `
        update zigo.service_requests
        set status_code = 'cancelled',
            cancelled_reason = $3
        where id = $1 and status_code <> 'completed'
        returning id, cluster_id as "clusterId", coalesce(metadata, '{}'::jsonb) as metadata
      `,
      [serviceRequestId, actorUserId, reason]
    );
    if (result.rows[0]) {
      await releaseCapacityReservations(client, {
        serviceRequestId,
        statusCode: "cancelled",
        reason
      });
      await upsertBookingOrchestrationState(client, {
        serviceRequestId,
        clusterId: result.rows[0].clusterId,
        demandStatus: "cancelled",
        riskStatus: "closed",
        supplyStatus: "released",
        bookingType: result.rows[0].metadata?.bookingType === "schedule" ? "schedule" : "instant",
        assignType: String(result.rows[0].metadata?.assignmentMode || "manual"),
        lastEventType: "booking.cancelled",
        metadata: { reason }
      });
      await writeAdminAction(client, actorUserId, serviceRequestId, "cancel", reason, {});
    }
    await client.query("commit");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function forceCloseBooking(serviceRequestId: string, actorUserId: string, reason: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureBookingEngineSchema(client);
    const result = await client.query<{ id: string; clusterId: string; metadata: Record<string, unknown> }>(
      `
        update zigo.service_requests
        set status_code = 'completed',
            completed_at = now(),
            metadata = metadata || jsonb_build_object('forceClosed', true, 'forceCloseReason', $3)
        where id = $1 and status_code <> 'completed'
        returning id, cluster_id as "clusterId", coalesce(metadata, '{}'::jsonb) as metadata
      `,
      [serviceRequestId, actorUserId, reason]
    );
    if (result.rows[0]) {
      await releaseCapacityReservations(client, {
        serviceRequestId,
        statusCode: "completed",
        reason
      });
      await upsertBookingOrchestrationState(client, {
        serviceRequestId,
        clusterId: result.rows[0].clusterId,
        demandStatus: "completed",
        riskStatus: "closed",
        supplyStatus: "released",
        bookingType: result.rows[0].metadata?.bookingType === "schedule" ? "schedule" : "instant",
        assignType: String(result.rows[0].metadata?.assignmentMode || "manual"),
        lastEventType: "booking.closed",
        metadata: { reason }
      });
      await writeAdminAction(client, actorUserId, serviceRequestId, "force_close", reason, {});
    }
    await client.query("commit");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLaunchReport() {
  const [clusterDemand, assistantUtilization, paymentTotals, cancellations, sla] = await Promise.all([
    pool.query(`
      select cluster_id as "clusterId", status_code as "statusCode", count(*)::int as count
      from zigo.service_requests
      group by cluster_id, status_code
      order by count desc
    `),
    pool.query(`
      select av.status_code as "statusCode", count(*)::int as count
      from zigo.assistant_availability av
      group by av.status_code
    `),
    pool.query(`
      select status_code as "statusCode", count(*)::int as count, coalesce(sum(amount_paise), 0)::int as "amountPaise"
      from zigo.payment_transactions
      group by status_code
    `),
    pool.query(`
      select cancelled_reason as reason, count(*)::int as count
      from zigo.service_requests
      where status_code = 'cancelled'
      group by cancelled_reason
      order by count desc
    `),
    pool.query(`
      select
        count(*) filter (where status_code = 'completed')::int as completed,
        count(*) filter (where status_code = 'failed')::int as failed,
        count(*) filter (where status_code = 'approval_pending')::int as "approvalPending"
      from zigo.service_requests
    `)
  ]);

  return {
    clusterDemand: clusterDemand.rows,
    assistantUtilization: assistantUtilization.rows,
    paymentTotals: paymentTotals.rows,
    cancellations: cancellations.rows,
    sla: sla.rows[0]
  };
}

async function writeAdminAction(
  client: Pick<typeof pool, "query">,
  actorUserId: string,
  serviceRequestId: string,
  actionType: string,
  reason: string,
  afterData: Record<string, unknown>
) {
  await client.query(
    `
      insert into zigo.admin_actions
        (actor_user_id, entity_type, entity_id, notes, after_data)
      values ($1, 'service_request', $2, $3, $4::jsonb)
    `,
    [actorUserId, serviceRequestId, `${actionType}: ${reason}`, JSON.stringify(afterData)]
  );
}
