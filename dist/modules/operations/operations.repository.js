import { pool } from "../../db/pool.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
import { isPointInPolygon, parseWktPolygon } from "../../utils/geofence.js";
import { generateZigoBookingReference, isZigoBookingReference, zigoServiceTypeCode } from "../../utils/bookingReference.js";
import { calculateClusterCategoryPricing } from "../pricing/pricing.js";
import { quotePriceMaster, resolveBookingEngineRuleForContext } from "../masters/masters.repository.js";
import { getBookingEngineSetting, getBookingTypeAutomationSetting } from "../settings/settings.repository.js";
import { ensurePaymentsSchema } from "../payments/payments.repository.js";
import { ensureBookingEngineSchema, releaseCapacityReservations, upsertBookingOrchestrationState, upsertCapacityReservation } from "./bookingEngine.js";
import { stopAssistantCalendarBlocksForBooking } from "./assistantDispatchEngine.js";
async function ensureCustomerDisputeSchema(client = pool) {
    await client.query(`
    create table if not exists zigo.customer_disputes (
      id uuid primary key default gen_random_uuid(),
      service_request_id uuid not null references zigo.service_requests(id) on delete cascade,
      customer_user_id uuid not null references zigo.users(id) on delete cascade,
      assigned_admin_user_id uuid references zigo.users(id) on delete set null,
      status_code text not null default 'open',
      subject text not null default 'Booking dispute',
      description text,
      request_refund boolean not null default false,
      requested_refund_amount_paise int not null default 0,
      payment_mode text,
      resolution_type text,
      resolution_amount_paise int not null default 0,
      resolution_reason text,
      admin_response text,
      resolved_at timestamptz,
      resolved_by_user_id uuid references zigo.users(id) on delete set null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_customer_disputes_booking on zigo.customer_disputes(service_request_id, created_at desc);
    create index if not exists idx_customer_disputes_status on zigo.customer_disputes(status_code, created_at desc);
    create index if not exists idx_customer_disputes_customer on zigo.customer_disputes(customer_user_id, created_at desc);
  `);
}
const locationProviderTimeoutMs = 3500;
let olaAccessToken = null;
const assistantOnlineStatusCodes = new Set(["available", "online", "active", "working"]);
const notServiceableMessage = "This location is not serviceable yet. Please choose another location within an active cluster.";
async function ensureCustomerProfilesForSearch(db, term) {
    await db.query(`
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
    `, [term]);
}
export async function listBookings(input = {}) {
    await ensureBookingEngineSchema();
    await ensurePaymentsSchema();
    const tab = input.tab || "pending_assign";
    const page = Math.max(1, Number(input.page || 1));
    const pageSize = Math.min(100, Math.max(5, Number(input.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const startDate = input.datePreset === "all" ? null : input.datePreset === "today" ? "today" : input.startDate || null;
    const endDate = input.datePreset === "all" ? null : input.datePreset === "today" ? "today" : input.endDate || input.startDate || null;
    const search = input.search?.trim() ? `%${input.search.trim()}%` : null;
    const result = await pool.query(`
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
        csm.id as "serviceMasterId",
        csm.service_title as "serviceMasterName",
        coalesce(cat.config->'categorySettings'->>'homeDisplayMode', case when coalesce((cat.config->'categorySettings'->>'showInHomePage')::boolean, true) then 'category' else 'categoryPrice' end) as "homeDisplayMode",
        coalesce(cart_summary.service_names, s.name) as "cartServiceNames",
        coalesce(cart_summary.category_names, cat.name) as "cartCategoryNames",
        cart_summary.store_names as "cartStoreNames",
        sr.notes,
        sr.customer_notes as "customerNotes",
        sr.duration_minutes as "durationMinutes",
        sr.scheduled_at as "scheduledAt",
        sr.booking_start_at as "bookingStartAt",
        sr.booking_end_at as "bookingEndAt",
        sr.booking_available_at as "bookingAvailableAt",
        sr.actual_task_started_at as "actualTaskStartedAt",
        sr.completed_at as "completedAt",
        sr.assistant_start_delay_minutes as "assistantStartDelayMinutes",
        sr.delay_credit_minutes as "delayCreditMinutes",
        sr.booking_at as "bookingAt",
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
        coalesce(bbs.grand_total_paise, sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise",
        sr.estimated_amount_paise as "estimatedAmountPaise",
        coalesce(bbs.base_price_paise, sr.base_price_paise, 0) as "basePricePaise",
        coalesce(bbs.discount_paise, sr.discount_paise, 0) as "discountPaise",
        coalesce(bbs.selling_price_paise, sr.selling_price_paise, 0) as "sellingPricePaise",
        coalesce(bbs.item_total_paise,
          case when sr.metadata->'pricingBreakdown'->>'itemTotalPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'itemTotalPaise')::bigint end,
          sr.selling_price_paise, 0) as "itemTotalPaise",
        coalesce(bbs.tax_amount_paise,
          case when sr.metadata->'pricingBreakdown'->>'taxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'taxAmountPaise')::bigint end,
          0) as "taxAmountPaise",
        coalesce(bbs.inclusive_tax_amount_paise,
          case when sr.metadata->'pricingBreakdown'->>'inclusiveTaxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'inclusiveTaxAmountPaise')::bigint end,
          0) as "inclusiveTaxAmountPaise",
        coalesce(bbs.exclusive_tax_amount_paise,
          case when sr.metadata->'pricingBreakdown'->>'exclusiveTaxAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'exclusiveTaxAmountPaise')::bigint end,
          0) as "exclusiveTaxAmountPaise",
        coalesce(bbs.tip_amount_paise,
          case when sr.metadata->'pricingBreakdown'->>'tipAmountPaise' ~ '^\d+$' then (sr.metadata->'pricingBreakdown'->>'tipAmountPaise')::bigint end,
          case when sr.metadata->>'tipAmountPaise' ~ '^\d+$' then (sr.metadata->>'tipAmountPaise')::bigint end,
          0) as "tipAmountPaise",
        coalesce(bbs.grand_total_paise, sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "grandTotalPaise",
        coalesce(bbs.tax_details, sr.metadata->'pricingBreakdown'->'taxRows', sr.payment_details->'taxRows', '[]'::jsonb) as "taxDetails",
        coalesce(bbs.pricing_details, sr.metadata->'pricingBreakdown', '{}'::jsonb) as "billingSnapshot",
        sr.waiting_time_minutes as "waitingTimeMinutes",
        sr.waiting_charges_paise as "waitingChargesPaise",
        coalesce(nullif(sr.metadata->>'extensionChargesPaise', '')::bigint, 0) as "extensionChargesPaise",
        coalesce(sr.metadata->'timeExtensions', '[]'::jsonb) as "timeExtensions",
        sr.currency,
        coalesce(payment_summary.payment_type, sr.payment_type, sr.metadata->>'paymentType', '-') as "paymentType",
        sr.payment_status as "paymentStatus",
        sr.payment_details as "paymentDetails",
        case
          when coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) <= 0 then
            coalesce(sr.is_paid, false) or lower(coalesce(sr.payment_status, '')) in ('paid', 'success', 'captured', 'completed')
          else greatest(
            coalesce(payment_summary.paid_amount_paise, 0),
            coalesce(razorpay_summary.paid_amount_paise, 0),
            coalesce(nullif(sr.payment_details->>'paidAmountPaise', '')::bigint, 0),
            case when coalesce(sr.is_paid, false) then coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) else 0 end
          ) >= coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0)
        end as "isPaid",
        greatest(
          coalesce(payment_summary.paid_amount_paise, 0),
          coalesce(razorpay_summary.paid_amount_paise, 0),
          coalesce(nullif(sr.payment_details->>'paidAmountPaise', '')::bigint, 0),
          case
            when coalesce(sr.is_paid, false) or lower(coalesce(sr.payment_status, '')) in ('paid', 'success', 'captured', 'completed')
            then coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0)
            else 0
          end
        )::bigint as "paidAmountPaise",
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
        ta.actual_started_at as "assignmentActualStartedAt",
        ta.start_delay_minutes as "assignmentStartDelayMinutes",
        ta.delay_credit_minutes as "assignmentDelayCreditMinutes",
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
        coalesce(profile_doc.preview_url, au.metadata->>'profilePictureUrl') as "assistantProfilePictureUrl",
        coalesce(working_tasks.count, 0)::int as "assistantWorkingTasks",
        working_tasks."nextAvailableAt" as "assistantNextAvailableAt"
      from zigo.service_requests sr
      left join zigo.booking_billing_snapshots bbs on bbs.service_request_id = sr.id
      join zigo.customers c on c.id = sr.customer_id
      join zigo.users u on u.id = c.user_id
      left join zigo.clusters cl on cl.id = sr.cluster_id
      left join zigo.services s on s.id = sr.service_id
      left join zigo.categories cat on cat.id = sr.category_id
      left join zigo.category_service_masters csm
        on csm.id = case
          when coalesce(cat.config->'categorySettings'->>'serviceMasterId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cat.config->'categorySettings'->>'serviceMasterId')::uuid
          else null
        end
      left join zigo.booking_orchestration_state os on os.service_request_id = sr.id
      left join lateral (
        select
          coalesce(
            (sr.scheduled_at at time zone 'Asia/Kolkata')::date,
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
          coalesce(max(pt.provider), '-') as payment_type,
          coalesce(sum(pt.amount_paise) filter (where pt.status_code in ('paid', 'success', 'captured', 'completed')), 0)::bigint as paid_amount_paise
        from zigo.payment_transactions pt
        where pt.service_request_id = sr.id
      ) payment_summary on true
      left join lateral (
        select coalesce(sum(rp.amount_paise) filter (where rp.status_code in ('paid', 'success', 'captured', 'completed')), 0)::bigint as paid_amount_paise
        from zigo.razorpay_payments rp
        where rp.service_request_id = sr.id
      ) razorpay_summary on true
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
          when sr.status_code in ('confirmed', 'processing', 'payment_pending', 'paid', 'queued') then 'pending_assign'
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
            case when coalesce(wsr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (wsr.metadata->>'bookingAvailableAt')::timestamptz else null end,
            case when coalesce(wsr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (wsr.metadata->>'expectedFreeAt')::timestamptz else null end,
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
        or coalesce(csm.service_title, '') ilike $4
        or coalesce(cl.name, '') ilike $4
        or coalesce(au.display_name, '') ilike $4
        or coalesce(au.phone, '') ilike $4
        or coalesce(a.assistant_code, '') ilike $4
      )
      order by service_date.service_sort_at desc, sr.created_at desc
      limit $5 offset $6
    `, [tab, startDate, endDate, search, pageSize, offset]);
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
export async function listBookingReviews(input = {}) {
    const page = Math.max(1, Math.round(Number(input.page || 1)));
    const pageSize = Math.max(5, Math.min(1000, Math.round(Number(input.pageSize || 50))));
    const offset = (page - 1) * pageSize;
    const search = String(input.search || "").trim();
    const params = [];
    const where = [];
    if (input.startDate) {
        params.push(input.startDate);
        where.push(`(br.created_at at time zone 'Asia/Kolkata')::date >= $${params.length}::date`);
    }
    if (input.endDate) {
        params.push(input.endDate);
        where.push(`(br.created_at at time zone 'Asia/Kolkata')::date <= $${params.length}::date`);
    }
    if (search) {
        params.push(`%${search.toLowerCase()}%`);
        where.push(`(
      lower(coalesce(sr.request_number, '')) like $${params.length}
      or lower(br.service_request_id::text) like $${params.length}
      or lower(coalesce(c.customer_code, '')) like $${params.length}
      or lower(coalesce(cu.display_name, '')) like $${params.length}
      or lower(coalesce(cu.phone, '')) like $${params.length}
      or lower(coalesce(a.assistant_code, '')) like $${params.length}
      or lower(coalesce(au.display_name, '')) like $${params.length}
      or lower(coalesce(au.phone, '')) like $${params.length}
      or lower(coalesce(cat.name, '')) like $${params.length}
      or lower(coalesce(csm.service_title, '')) like $${params.length}
      or lower(coalesce(br.review_text, '')) like $${params.length}
      or br.zigo_rating::text like $${params.length}
      or br.service_rating::text like $${params.length}
      or br.assistant_rating::text like $${params.length}
    )`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const result = await pool.query(`
      select
        br.id,
        br.service_request_id as "bookingId",
        sr.request_number as "bookingNumber",
        br.customer_user_id as "customerUserId",
        c.id as "customerId",
        c.customer_code as "customerCode",
        cu.display_name as "customerName",
        cu.phone as "customerPhone",
        br.assistant_id as "assistantId",
        a.assistant_code as "assistantCode",
        au.display_name as "assistantName",
        au.phone as "assistantPhone",
        sr.category_id as "categoryId",
        cat.name as "categoryName",
        csm.id as "serviceMasterId",
        csm.service_title as "serviceMasterName",
        br.zigo_rating as "zigoRating",
        br.service_rating as "serviceRating",
        br.assistant_rating as "assistantRating",
        round((br.zigo_rating + br.service_rating + br.assistant_rating)::numeric / 3, 1) as "overallRating",
        br.review_text as "reviewText",
        br.metadata,
        br.created_at as "createdAt",
        br.updated_at as "updatedAt"
      from zigo.booking_reviews br
      join zigo.service_requests sr on sr.id = br.service_request_id
      left join zigo.customers c on c.id = sr.customer_id
      left join zigo.users cu on cu.id = coalesce(c.user_id, br.customer_user_id)
      left join zigo.assistants a on a.id = br.assistant_id
      left join zigo.users au on au.id = a.user_id
      left join zigo.categories cat on cat.id = sr.category_id
      left join zigo.category_service_masters csm
        on csm.id = case
          when coalesce(cat.config->'categorySettings'->>'serviceMasterId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cat.config->'categorySettings'->>'serviceMasterId')::uuid
          else null
        end
      ${whereSql}
      order by br.created_at desc
      limit $${params.length + 1} offset $${params.length + 2}
    `, [...params, pageSize, offset]);
    const total = await pool.query(`
      select count(*)::text as total
      from zigo.booking_reviews br
      join zigo.service_requests sr on sr.id = br.service_request_id
      left join zigo.customers c on c.id = sr.customer_id
      left join zigo.users cu on cu.id = coalesce(c.user_id, br.customer_user_id)
      left join zigo.assistants a on a.id = br.assistant_id
      left join zigo.users au on au.id = a.user_id
      left join zigo.categories cat on cat.id = sr.category_id
      left join zigo.category_service_masters csm
        on csm.id = case
          when coalesce(cat.config->'categorySettings'->>'serviceMasterId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (cat.config->'categorySettings'->>'serviceMasterId')::uuid
          else null
        end
      ${whereSql}
    `, params);
    const totalRecords = Number(total.rows[0]?.total || 0);
    return {
        rows: result.rows,
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) }
    };
}
async function ensureCustomerUnserviceableLocationSchema(client = pool) {
    await client.query(`
    create table if not exists zigo.customer_unserviceable_locations (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references zigo.customers(id) on delete set null,
      user_id uuid references zigo.users(id) on delete set null,
      latitude numeric(10,7) not null,
      longitude numeric(10,7) not null,
      location_title text,
      address_text text not null,
      state_name text,
      city_name text,
      postal_code text,
      hit_count integer not null default 1,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_customer_unserviceable_locations_customer
      on zigo.customer_unserviceable_locations(customer_id, last_seen_at desc);
    create index if not exists idx_customer_unserviceable_locations_seen
      on zigo.customer_unserviceable_locations(last_seen_at desc);
    create index if not exists idx_customer_unserviceable_locations_area
      on zigo.customer_unserviceable_locations(state_name, city_name, postal_code);
  `);
}
export async function listCustomerUnserviceableLocationsReport(input = {}) {
    await ensureCustomerUnserviceableLocationSchema();
    const page = Math.max(1, Math.round(Number(input.page || 1)));
    const pageSize = Math.max(5, Math.min(1000, Math.round(Number(input.pageSize || 50))));
    const offset = (page - 1) * pageSize;
    const search = String(input.search || "").trim();
    const params = [];
    const where = [];
    if (input.startDate) {
        params.push(input.startDate);
        where.push(`(cul.last_seen_at at time zone 'Asia/Kolkata')::date >= $${params.length}::date`);
    }
    if (input.endDate) {
        params.push(input.endDate);
        where.push(`(cul.last_seen_at at time zone 'Asia/Kolkata')::date <= $${params.length}::date`);
    }
    if (search) {
        params.push(`%${search.toLowerCase()}%`);
        where.push(`(
      lower(coalesce(cul.location_title, '')) like $${params.length}
      or lower(coalesce(cul.address_text, '')) like $${params.length}
      or lower(coalesce(cul.state_name, '')) like $${params.length}
      or lower(coalesce(cul.city_name, '')) like $${params.length}
      or lower(coalesce(cul.postal_code, '')) like $${params.length}
      or lower(coalesce(c.customer_code, '')) like $${params.length}
      or lower(coalesce(u.display_name, '')) like $${params.length}
      or lower(coalesce(u.phone, '')) like $${params.length}
      or cul.latitude::text like $${params.length}
      or cul.longitude::text like $${params.length}
    )`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const result = await pool.query(`
      select
        cul.id,
        cul.customer_id as "customerId",
        c.customer_code as "customerCode",
        u.display_name as "customerName",
        u.phone as "customerPhone",
        cul.location_title as "locationTitle",
        cul.address_text as address,
        cul.state_name as "stateName",
        cul.city_name as "cityName",
        cul.postal_code as "postalCode",
        cul.latitude,
        cul.longitude,
        cul.hit_count as "hitCount",
        cul.first_seen_at as "firstSeenAt",
        cul.last_seen_at as "lastSeenAt",
        cul.created_at as "createdAt",
        cul.updated_at as "updatedAt"
      from zigo.customer_unserviceable_locations cul
      left join zigo.customers c on c.id = cul.customer_id
      left join zigo.users u on u.id = coalesce(c.user_id, cul.user_id)
      ${whereSql}
      order by cul.last_seen_at desc, cul.hit_count desc
      limit $${params.length + 1} offset $${params.length + 2}
    `, [...params, pageSize, offset]);
    const total = await pool.query(`
      select count(*)::text as total
      from zigo.customer_unserviceable_locations cul
      left join zigo.customers c on c.id = cul.customer_id
      left join zigo.users u on u.id = coalesce(c.user_id, cul.user_id)
      ${whereSql}
    `, params);
    const totalRecords = Number(total.rows[0]?.total || 0);
    return {
        rows: result.rows,
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) }
    };
}
export async function searchCustomersForBooking(search) {
    const term = `%${search.trim()}%`;
    await ensureCustomerProfilesForSearch(pool, term);
    const result = await pool.query(`
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
    `, [term]);
    return result.rows;
}
export async function listCustomerAddressesForBooking(customerId) {
    await assertBookingCustomer(customerId);
    const result = await pool.query(`
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
      where ca.customer_id = $1::uuid
        and ca.deleted_at is null
        and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
      order by ca.is_default desc, ca.created_at desc
    `, [customerId]);
    return result.rows;
}
export async function validateBookingLocation(input) {
    const customer = await assertBookingCustomer(input.customerId);
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
        throw new HttpError(400, "Latitude and longitude are required.");
    }
    if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
        throw new HttpError(400, "Latitude or longitude is outside the valid range.");
    }
    if (input.addressId) {
        const address = await pool.query(`
        select id
        from zigo.customer_addresses
        where id = $1::uuid
          and customer_id = $2::uuid
          and deleted_at is null
        limit 1
      `, [input.addressId, input.customerId]);
        if (!address.rows[0])
            throw new HttpError(400, "Selected address was not found for this customer.");
    }
    const clusters = await pool.query(`
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
    `);
    for (const cluster of clusters.rows) {
        const polygon = parseWktPolygon(cluster.polygonDescription);
        const serviceRangeMeters = Number(cluster.metadata?.serviceRangeMeters);
        const rangeCenter = clusterRangeCenter(cluster, polygon);
        const insidePolygon = polygon.length >= 4 && isPointInPolygon(input.latitude, input.longitude, polygon);
        const withinRange = Number.isFinite(serviceRangeMeters) && serviceRangeMeters > 0 && rangeCenter
            ? distanceMeters([input.longitude, input.latitude], rangeCenter) <= serviceRangeMeters
            : false;
        const hasConfiguredBoundary = polygon.length >= 4 || (Number.isFinite(serviceRangeMeters) && serviceRangeMeters > 0 && rangeCenter);
        if (!hasConfiguredBoundary || (!insidePolygon && !withinRange))
            continue;
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
export async function listBookingLocationServiceBoundaries() {
    const result = await pool.query(`
      select
        cl.id as "clusterId",
        cl.name,
        cl.polygon_description as "polygonDescription",
        cl.priority
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
      order by cl.priority, cl.name
    `);
    return result.rows
        .map((row) => {
        const polygon = parseWktPolygon(row.polygonDescription);
        return {
            clusterId: row.clusterId,
            name: row.name,
            priority: Number(row.priority || 0),
            polygonCoordinates: polygon.map(([longitude, latitude]) => ({ latitude, longitude }))
        };
    })
        .filter((row) => row.polygonCoordinates.length >= 3);
}
export async function searchBookingLocations(query) {
    const text = query.trim();
    const direct = directCoordinateCandidate(text);
    if (direct)
        return [direct];
    const placeLookups = await Promise.allSettled([
        fetchOlaPlaceCandidates("autocomplete", text),
        fetchOlaPlaceCandidates("textsearch", text)
    ]);
    const placeCandidates = placeLookups.flatMap((lookup) => (lookup.status === "fulfilled" ? lookup.value : []));
    if (placeCandidates.length)
        return rankLocationCandidates(placeCandidates, text).slice(0, 12);
    const geocodeLookup = await Promise.allSettled([fetchOlaLocationCandidates("geocode", text)]);
    const candidates = geocodeLookup.flatMap((lookup) => (lookup.status === "fulfilled" ? lookup.value : []));
    if (candidates.length)
        return rankLocationCandidates(candidates, text).slice(0, 12);
    const lookups = [...placeLookups, ...geocodeLookup];
    const rejected = lookups.filter((lookup) => lookup.status === "rejected");
    const firstError = rejected[0]?.reason;
    if (rejected.length === lookups.length && firstError instanceof HttpError)
        throw firstError;
    throw new HttpError(502, "Ola Places did not return any places for this search.");
}
export async function reverseBookingLocation(input) {
    assertCoordinateRange(input.latitude, input.longitude);
    const result = await fetchOlaReverseGeocode(input.latitude, input.longitude);
    return {
        label: result?.label || "Picked location",
        address: result?.address || formatCoordinateAddress(input.latitude, input.longitude),
        latitude: input.latitude,
        longitude: input.longitude,
        stateName: result?.stateName || "",
        cityName: result?.cityName || "",
        postalCode: result?.postalCode || "",
        source: "reverse",
        provider: result?.provider || "local"
    };
}
function clusterRangeCenter(cluster, polygon) {
    const metadata = cluster.metadata || {};
    const latitude = Number(metadata.serviceCenterLatitude ?? metadata.centerLatitude ?? metadata.latitude);
    const longitude = Number(metadata.serviceCenterLongitude ?? metadata.centerLongitude ?? metadata.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude))
        return [longitude, latitude];
    if (polygon.length >= 4)
        return polygonCentroid(polygon);
    return null;
}
async function fetchOlaLocationCandidates(kind, query) {
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
async function fetchOlaPlaceCandidates(kind, query) {
    const payload = await requestOlaMaps(kind, (url) => {
        if (kind === "autocomplete") {
            url.searchParams.set("input", query);
            url.searchParams.set("location", "28.4595,77.0266");
            url.searchParams.set("radius", "150000");
        }
        else {
            url.searchParams.set("query", query);
        }
        url.searchParams.set("language", "en");
    });
    return collectLocationCandidates(payload, query, "search");
}
async function fetchOlaReverseGeocode(latitude, longitude) {
    const payload = await requestOlaMaps("reverse-geocode", (url) => {
        url.searchParams.set("latlng", `${latitude},${longitude}`);
    });
    return collectLocationCandidates(payload, "Picked location", "reverse")[0] ?? null;
}
async function requestOlaMaps(path, configure) {
    if (!env.OLA_MAPS_API_KEY && (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET)) {
        throw new HttpError(503, "Ola Maps credentials are not configured. Add OLA_MAPS_API_KEY or OAuth client credentials and restart the admin server.");
    }
    const url = new URL(`https://api.olamaps.io/places/v1/${path}`);
    const token = await getOlaAccessToken().catch(() => null);
    if (!token && env.OLA_MAPS_API_KEY)
        url.searchParams.set("api_key", env.OLA_MAPS_API_KEY);
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
    if (!response)
        throw new HttpError(504, "Ola Maps did not respond. Please try again.");
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
    if (!env.OLA_MAPS_CLIENT_ID || !env.OLA_MAPS_CLIENT_SECRET)
        return null;
    if (olaAccessToken && olaAccessToken.expiresAt > Date.now() + 30_000)
        return olaAccessToken.token;
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
    const payload = (await response.json().catch(() => ({})));
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
async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), locationProviderTimeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
    }
}
function directCoordinateCandidate(value) {
    const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match)
        return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!isValidCoordinate(latitude, longitude))
        return null;
    return { label: "Entered coordinates", address: formatCoordinateAddress(latitude, longitude), latitude, longitude, source: "coordinates", provider: "local" };
}
function locationSearchErrorMessage(payload, fallback) {
    if (!payload || typeof payload !== "object")
        return fallback;
    const item = payload;
    return String(item.message || item.error || item.error_message || fallback);
}
function isOlaDomainRestriction(payload) {
    return /domain is not allowed|domain.*not allowed/i.test(locationSearchErrorMessage(payload, ""));
}
function collectLocationCandidates(payload, fallbackText = "Searched location", source = "search") {
    const results = [];
    const seen = new Set();
    const visit = (value) => {
        if (!value || typeof value !== "object")
            return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        const item = value;
        const lat = numberFromUnknown(item.lat ?? item.latitude ?? item.y);
        const lng = numberFromUnknown(item.lng ?? item.lon ?? item.longitude ?? item.x);
        const geometry = item.geometry;
        const location = item.location;
        const position = item.position;
        const geometryLocation = geometry?.location;
        const nestedLat = numberFromUnknown(geometry?.lat ?? geometry?.latitude ?? geometryLocation?.lat ?? geometryLocation?.latitude ?? location?.lat ?? location?.latitude ?? position?.lat ?? position?.latitude);
        const nestedLng = numberFromUnknown(geometry?.lng ?? geometry?.lon ?? geometry?.longitude ?? geometryLocation?.lng ?? geometryLocation?.lon ?? geometryLocation?.longitude ?? location?.lng ?? location?.lon ?? location?.longitude ?? position?.lng ?? position?.lon ?? position?.longitude);
        const latitude = lat ?? nestedLat;
        const longitude = lng ?? nestedLng;
        if (latitude != null && longitude != null && isValidCoordinate(latitude, longitude)) {
            const structuredFormatting = item.structured_formatting;
            const textValue = item.name || structuredFormatting?.main_text || item.description || item.formatted_address || item.formattedAddress || item.address || item.vicinity;
            const label = String(textValue || fallbackText);
            const secondaryText = structuredFormatting?.secondary_text ? String(structuredFormatting.secondary_text) : "";
            const address = String(item.formatted_address || item.formattedAddress || item.address || item.description || item.vicinity || secondaryText || textValue || fallbackText || label);
            const components = Array.isArray(item.address_components)
                ? item.address_components
                : Array.isArray(item.addressComponents) ? item.addressComponents : [];
            const componentValue = (matchingTypes) => {
                const component = components.find((entry) => {
                    if (!entry || typeof entry !== "object")
                        return false;
                    const types = Array.isArray(entry.types)
                        ? entry.types.map((type) => String(type).toLowerCase())
                        : [String(entry.type || "").toLowerCase()];
                    return matchingTypes.some((type) => types.includes(type));
                });
                return String(component?.long_name || component?.longName || component?.name || component?.short_name || component?.shortName || "").trim();
            };
            const stateName = String(item.state || item.state_name || item.stateName || componentValue(["administrative_area_level_1", "state"]) || "").trim();
            const cityName = String(item.city || item.city_name || item.cityName || item.locality || componentValue(["locality", "administrative_area_level_2", "city"]) || "").trim();
            const postalCode = String(item.postal_code || item.postalCode || item.postcode || item.pincode || item.zip || componentValue(["postal_code", "postcode"]) || "").trim();
            const key = `${latitude.toFixed(6)},${longitude.toFixed(6)},${label}`;
            if (textValue && !seen.has(key)) {
                seen.add(key);
                results.push({ label, address, latitude, longitude, stateName, cityName, postalCode, source, provider: "ola_maps" });
            }
        }
        for (const child of Object.values(item))
            visit(child);
    };
    visit(payload);
    return results;
}
function rankLocationCandidates(candidates, query) {
    const queryText = query.toLowerCase();
    const seen = new Set();
    return candidates
        .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
        .map((candidate) => {
        const text = `${candidate.label} ${candidate.address}`.toLowerCase();
        const score = (text.includes(queryText) ? 100 : 0) +
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
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function numberFromUnknown(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}
function assertCoordinateRange(latitude, longitude) {
    if (!isValidCoordinate(latitude, longitude))
        throw new HttpError(400, "Latitude or longitude is outside the valid range.");
}
function isValidCoordinate(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
function formatCoordinateAddress(latitude, longitude) {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
async function assertBookingCustomer(customerId) {
    const result = await pool.query(`
      select
        c.id,
        u.display_name as "displayName",
        coalesce(u.metadata->>'accountStatus', 'active') as status
      from zigo.customers c
      join zigo.users u on u.id = c.user_id
      where c.id = $1::uuid
        and u.deleted_at is null
      limit 1
    `, [customerId]);
    const customer = result.rows[0];
    if (!customer)
        throw new HttpError(400, "Selected customer was not found.");
    if (customer.status !== "active") {
        throw new HttpError(400, `Customer "${customer.displayName || customerId}" is not active. Activate the customer before selecting booking location.`);
    }
    return customer;
}
function polygonCentroid(polygon) {
    const points = polygon.slice(0, -1);
    if (!points.length)
        return [0, 0];
    const totals = points.reduce((sum, [longitude, latitude]) => ({ longitude: sum.longitude + longitude, latitude: sum.latitude + latitude }), { longitude: 0, latitude: 0 });
    return [totals.longitude / points.length, totals.latitude / points.length];
}
function distanceMeters(from, to) {
    const [fromLng, fromLat] = from;
    const [toLng, toLat] = to;
    const earthRadiusMeters = 6371000;
    const toRadians = (value) => (value * Math.PI) / 180;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function activeTimeCategories(categories) {
    return (categories || [])
        .filter((category) => Boolean(category) && typeof category === "object")
        .filter((category) => category.isActive !== false)
        .map((category) => ({
        ...category,
        timeSlots: Array.isArray(category.timeSlots)
            ? normalizeScheduleTimeValues(category.timeSlots)
            : []
    }))
        .sort((left, right) => Number(left["sortOrder"] || 0) - Number(right["sortOrder"] || 0));
}
function normalizeScheduleTimeValue(value) {
    const text = String(value || "").trim().toUpperCase();
    const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
    if (!match)
        return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3];
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59)
        return null;
    if (period) {
        if (hours < 1 || hours > 12)
            return null;
        if (period === "AM")
            hours = hours === 12 ? 0 : hours;
        if (period === "PM")
            hours = hours === 12 ? 12 : hours + 12;
    }
    else if (hours < 0 || hours > 23) {
        return null;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function normalizeScheduleTimeValues(values) {
    return Array.from(new Set((values || []).map(normalizeScheduleTimeValue).filter((value) => Boolean(value))))
        .sort();
}
function normalizeBookingTypeRow(row) {
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
        timeSlots: Array.isArray(row?.timeSlots) ? normalizeScheduleTimeValues(row.timeSlots) : []
    };
}
function asBookingConfig(value) {
    if (!value || typeof value !== "object")
        return null;
    const row = value;
    if (row.isActive === false)
        return null;
    return row;
}
function bookingConfigMode(config) {
    return config?.mode === "schedule" || config?.mode === "instant" || config?.mode === "both" ? config.mode : null;
}
function bookingConfigAssignType(config) {
    return config?.instantMode === "automate" ? "automate" : config?.instantMode === "manual" ? "manual" : null;
}
function bookingConfigWaitWindow(config) {
    return 0;
}
async function resolveBookingAvailabilityConfig(db, input) {
    const bookingTypes = await db.query(`
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
    `);
    const defaultType = normalizeBookingTypeRow(bookingTypes.rows[0]);
    const instantType = normalizeBookingTypeRow(bookingTypes.rows.find((row) => row.bookingType === "instant") ?? bookingTypes.rows[0]);
    const scheduleType = normalizeBookingTypeRow(bookingTypes.rows.find((row) => row.bookingType === "schedule") ?? bookingTypes.rows[0]);
    const settings = await getBookingTypeAutomationSetting();
    let categoryConfig = null;
    let serviceConfig = null;
    let serviceMasterConfig = null;
    if (input.categoryId) {
        const category = await db.query(`
        select
          coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
          c.service_id as "serviceId",
          csm.booking_type as "serviceMasterBookingType"
        from zigo.categories c
        left join zigo.cluster_category_settings m
          on m.category_id = c.id
         and m.cluster_id = $1::uuid
         and coalesce(m.is_deleted, false) = false
         and coalesce(m.is_active, true) = true
         and coalesce(m.is_enabled, true) = true
        left join zigo.category_service_masters csm
          on csm.id::text = nullif(c.config->'categorySettings'->>'serviceMasterId', '')
         and coalesce(csm.is_deleted, false) = false
         and coalesce(csm.is_active, true) = true
         and coalesce(csm.is_enabled, true) = true
        where c.id = $2::uuid
          and coalesce(c.is_deleted, false) = false
          and coalesce(c.is_active, true) = true
          and coalesce(c.is_enabled, true) = true
        order by m.updated_at desc nulls last
        limit 1
      `, [input.clusterId, input.categoryId]);
        categoryConfig = asBookingConfig(category.rows[0]?.bookingTypeConfig);
        const serviceMasterBookingType = String(category.rows[0]?.serviceMasterBookingType || "").toLowerCase();
        if (serviceMasterBookingType === "both" || serviceMasterBookingType === "instant" || serviceMasterBookingType === "schedule") {
            serviceMasterConfig = { mode: serviceMasterBookingType };
        }
    }
    if (input.serviceId && !input.categoryId) {
        const service = await db.query(`
        select coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig"
        from zigo.cluster_service_settings m
        where m.cluster_id = $1::uuid
          and m.service_id = $2::uuid
          and coalesce(m.is_deleted, false) = false
          and coalesce(m.is_active, true) = true
          and coalesce(m.is_enabled, true) = true
        order by m.updated_at desc
        limit 1
      `, [input.clusterId, input.serviceId]);
        serviceConfig = asBookingConfig(service.rows[0]?.bookingTypeConfig);
    }
    const configs = (serviceMasterConfig ? [serviceMasterConfig, categoryConfig, serviceConfig] : categoryConfig ? [categoryConfig] : [serviceConfig]).filter(Boolean);
    const mode = configs.map(bookingConfigMode).find(Boolean) ?? "both";
    const assignType = configs.map(bookingConfigAssignType).find(Boolean) ?? "manual";
    const waitWindowMinutes = 0;
    const waitWindowNote = "";
    const scheduleSource = mode === "schedule" ? categoryConfig || serviceConfig || scheduleType : scheduleType;
    const scheduleConfig = {
        ...scheduleType,
        waitWindowMinutes,
        waitWindowNote,
        maxAdvanceDays: Number(scheduleSource?.maxAdvanceDays ?? scheduleType.maxAdvanceDays ?? 1),
        allowedDays: Array.isArray(scheduleSource?.allowedDays) ? scheduleSource.allowedDays : scheduleType.allowedDays,
        timeCategories: activeTimeCategories(Array.isArray(scheduleSource?.timeCategories) ? scheduleSource.timeCategories : scheduleType.timeCategories),
        timeSlots: Array.isArray(scheduleSource?.timeSlots) && scheduleSource.timeSlots.length ? normalizeScheduleTimeValues(scheduleSource.timeSlots) : scheduleType.timeSlots
    };
    const effectiveConfig = {
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
function scheduleDatesForConfig(config) {
    const maxAdvanceDays = Math.max(0, Number(config.maxAdvanceDays || 0));
    const allowed = new Set((config.allowedDays || []).map((item) => String(item).toLowerCase()));
    const dates = [];
    for (let offset = 0; offset <= maxAdvanceDays; offset += 1) {
        const token = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `next_${offset}`;
        if (allowed.size && !allowed.has(token) && !allowed.has(String(offset)))
            continue;
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
function scheduleSlotDate(dateValue, timeValue) {
    const [year, month, day] = String(dateValue || "").split("-").map(Number);
    const normalizedTime = normalizeScheduleTimeValue(timeValue);
    const [hour, minute] = String(normalizedTime || "").split(":").map(Number);
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute))
        return null;
    return new Date(year, month - 1, day, hour, minute, 0, 0);
}
function scheduleSlotEnd(dateValue, timeValue, durationMinutes) {
    const start = scheduleSlotDate(dateValue, timeValue);
    if (!start)
        return null;
    return new Date(start.getTime() + Math.max(1, Math.min(1440, Math.round(Number(durationMinutes || 30)))) * 60_000);
}
function nextOpenCapacityWindow(input) {
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
    if (candidateStartAt.getTime() > latestStartAt.getTime())
        return null;
    return { candidateStartAt, candidateEndAt };
}
function assistantReadyAtForInstant(input) {
    let readyAt = new Date(Math.max(input.requestAt.getTime(), input.baseAvailableAt?.getTime() || 0));
    const windows = [...(input.scheduledWindows || [])].sort((left, right) => left.start.getTime() - right.start.getTime());
    let moved = true;
    while (moved) {
        moved = false;
        for (const window of windows) {
            if (window.start.getTime() <= readyAt.getTime() && window.end.getTime() > readyAt.getTime()) {
                readyAt = new Date(window.end);
                moved = true;
                break;
            }
        }
    }
    return readyAt;
}
function instantAssistantCapacityWindow(input) {
    const scheduledWindows = input.scheduledWindows || [];
    const assistantReadyAt = assistantReadyAtForInstant({
        requestAt: input.requestAt,
        baseAvailableAt: input.baseAvailableAt,
        scheduledWindows
    });
    const assistantFreeInMinutes = Math.max(0, Math.ceil((assistantReadyAt.getTime() - input.requestAt.getTime()) / 60_000));
    if (input.maxReadyDelayMinutes != null && assistantFreeInMinutes > input.maxReadyDelayMinutes)
        return null;
    const candidateStartAt = addMinutes(assistantReadyAt, Math.max(0, input.etaMinutes) + Math.max(0, input.initiateMinutes || 0));
    const candidateEndAt = addMinutes(candidateStartAt, Math.max(1, input.durationMinutes));
    const overlaps = scheduledWindows.some((window) => candidateStartAt < window.end && candidateEndAt > window.start);
    if (overlaps)
        return null;
    return { assistantReadyAt, assistantFreeInMinutes, candidateStartAt, candidateEndAt };
}
function localDateText(value) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function localTimeText(value) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
async function createUniqueBookingRequestNumber(client, input) {
    const preferred = String(input.preferred || "").trim();
    if (isZigoBookingReference(preferred)) {
        const existing = await client.query(`select 1 from zigo.service_requests where request_number = $1 limit 1`, [preferred]);
        if (!existing.rows.length)
            return preferred;
    }
    const serviceTypeCode = zigoServiceTypeCode(input);
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = generateZigoBookingReference({
            serviceTypeCode,
            bookingType: input.bookingType,
            now: input.now || new Date()
        });
        const existing = await client.query(`select 1 from zigo.service_requests where request_number = $1 limit 1`, [candidate]);
        if (!existing.rows.length)
            return candidate;
    }
    throw new HttpError(409, "Unable to generate a unique booking ID. Please try again.");
}
function shortDurationLabel(minutes) {
    const value = Math.max(0, Math.round(Number(minutes || 0)));
    if (value < 60)
        return `${value} mins`;
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return `${hours} hr${hours === 1 ? "" : "s"}${mins ? ` ${mins} mins` : ""}`;
}
function addMinutes(value, minutes) {
    return new Date(value.getTime() + Math.max(0, Math.round(Number(minutes || 0))) * 60_000);
}
function activeBookingWindowOverlaps(leftStart, leftEnd, rightStart, rightEnd) {
    return leftStart < rightEnd && leftEnd > rightStart;
}
function minutesUntil(from, to) {
    if (!to)
        return null;
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 60_000));
}
function bookingEngineRuleOpen(rule, now = new Date(), options = {}) {
    if (!rule)
        return !options.requireRule;
    if (rule.serviceControlMode === "manual") {
        const status = String(rule.manualServiceStatus || "").toLowerCase();
        return status === "start" || status === "on" || status === "1" || status === "true";
    }
    if (rule.serviceControlMode === "auto") {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const parseMinutes = (value) => {
            const text = String(value || "").trim();
            if (!/^\d{2}:\d{2}$/.test(text))
                return null;
            const [hoursText, minutesText] = text.split(":");
            const hours = Number(hoursText);
            const minutes = Number(minutesText);
            if (!Number.isInteger(hours) || !Number.isInteger(minutes))
                return null;
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
                return null;
            return hours * 60 + minutes;
        };
        const startTimeMinutes = parseMinutes(rule.autoStartTime ?? rule.metadata?.serviceCalendar?.autoStartTime);
        const endTimeMinutes = parseMinutes(rule.autoEndTime ?? rule.metadata?.serviceCalendar?.autoEndTime);
        if (startTimeMinutes != null && endTimeMinutes != null) {
            if (startTimeMinutes === endTimeMinutes)
                return false;
            if (startTimeMinutes < endTimeMinutes) {
                return currentMinutes >= startTimeMinutes && currentMinutes < endTimeMinutes;
            }
            return currentMinutes >= startTimeMinutes || currentMinutes < endTimeMinutes;
        }
        const start = rule.autoStartAt ? new Date(rule.autoStartAt) : null;
        const end = rule.autoEndAt ? new Date(rule.autoEndAt) : null;
        if (start && Number.isFinite(start.getTime()) && now.getTime() < start.getTime())
            return false;
        if (end && Number.isFinite(end.getTime()) && now.getTime() > end.getTime())
            return false;
    }
    return true;
}
function bookingSupplyStatusFor(input) {
    if (!input.assistantId)
        return "unassigned";
    if (input.assignmentMode === "automate")
        return "assigned";
    return input.bookingType === "schedule" ? "reserved_for_manual" : "reserved_for_manual";
}
function bookingDemandStatusFor(statusCode) {
    if (["assigned", "accepted", "in_progress", "approval_pending", "completed", "cancelled", "failed", "rejected"].includes(statusCode))
        return statusCode;
    if (["confirmed", "processing", "payment_pending", "paid", "queued"].includes(statusCode))
        return "pending_assign";
    return statusCode || "pending_assign";
}
async function selectAssistantForCapacityWindow(db, input) {
    const assistants = await db.query(`
      select
        a.id as "assistantId",
        lower(coalesce(av.status_code, 'offline')) as "statusCode",
        active_work."busyFreeAt" as "busyFreeAt",
        coalesce(future_schedule."futureScheduledCount", 0)::int as "futureScheduledCount"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      left join lateral (
        select max(window_end) as "busyFreeAt"
        from (
          select coalesce(
            sr.booking_available_at,
            case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
            case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
            sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
          ) as window_end
          from zigo.task_assignments ta
          join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
          where ta.assistant_id = a.id
            and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
            and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
            and coalesce(sr.booking_type, sr.metadata->>'bookingType', 'instant') <> 'schedule'
          union all
          select acr.reserved_until as window_end
          from zigo.assistant_capacity_reservations acr
          where acr.assistant_id = a.id
            and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
            and acr.reserved_until > now()
            and coalesce(acr.booking_type, 'instant') <> 'schedule'
        ) active_windows
      ) active_work on true
      left join lateral (
        select count(*) as "futureScheduledCount"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and (
            coalesce(
              sr.booking_date,
              case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
              sr.scheduled_at::date
            ) > current_date
            or (
              coalesce(
                sr.booking_date,
                case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
                sr.scheduled_at::date
              ) = current_date
              and coalesce(sr.booking_time_slot, sr.metadata->>'scheduledTime', to_char(sr.scheduled_at, 'HH24:MI')) >= to_char(now(), 'HH24:MI')
            )
          )
      ) future_schedule on true
      where u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (
          a.current_cluster_id = $1::uuid
          or exists (
            select 1
            from zigo.assistant_cluster_map acm
            where acm.assistant_id = a.id
              and acm.cluster_id = $1::uuid
              and coalesce(acm.is_active, true) = true
          )
        )
        and coalesce(av.status_code, 'offline') = any($2::text[])
      order by a.id
      for update of a
    `, [input.clusterId, input.allowedStatusCodes?.length ? input.allowedStatusCodes : Array.from(assistantOnlineStatusCodes)]);
    if (!assistants.rows.length)
        return null;
    const blocked = await db.query(`
      select
        ta.assistant_id as "assistantId",
        coalesce(
          sr.booking_start_at,
          sr.scheduled_at,
          case
            when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
             and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
            then (sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time
            else null
          end
        ) as "startAt",
        coalesce(
          sr.booking_available_at,
          case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
          case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
          sr.booking_end_at,
          sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
          case
            when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
             and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
            then ((sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
            else null
          end
        ) as "endAt",
        sr.metadata->>'scheduledDate' as "scheduledDate",
        sr.metadata->>'scheduledTime' as "scheduledTime",
        coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
      from zigo.task_assignments ta
      join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
      where ta.assistant_id = any($1::uuid[])
        and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
        and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
        and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
        and coalesce(
          sr.booking_date,
          case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
          sr.scheduled_at::date
        ) >= $2::date
    `, [assistants.rows.map((assistant) => assistant.assistantId), localDateText(new Date())]);
    const scheduledByAssistant = new Map();
    for (const row of blocked.rows) {
        const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
        if (!start)
            continue;
        const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
        if (!scheduledByAssistant.has(row.assistantId))
            scheduledByAssistant.set(row.assistantId, []);
        scheduledByAssistant.get(row.assistantId).push({ start, end });
    }
    const latestStartAt = input.latestStartAt ?? input.slotStart;
    return assistants.rows
        .map((assistant) => {
        // A genuinely free assistant is available at the request's reference time.
        // Using a fresh Date here makes it a few milliseconds later than requireFreeAt
        // and incorrectly rejects every free assistant from an Instant booking.
        const nextAvailableAt = assistant.busyFreeAt ?? input.requireFreeAt ?? new Date();
        const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
        if (input.instantRequestAt && input.instantEtaMinutes != null) {
            const instantWindow = instantAssistantCapacityWindow({
                requestAt: input.instantRequestAt,
                baseAvailableAt: nextAvailableAt,
                etaMinutes: input.instantEtaMinutes,
                initiateMinutes: input.instantInitiateMinutes,
                maxReadyDelayMinutes: input.instantReadyByMinutes,
                durationMinutes: Math.max(1, Number(input.durationMinutes || 30)),
                scheduledWindows: scheduled
            });
            return instantWindow ? { ...assistant, nextAvailableAt, ...instantWindow } : null;
        }
        if (input.requireFreeAt) {
            const requiredAt = input.requireFreeAt.getTime();
            if (nextAvailableAt.getTime() > requiredAt)
                return null;
            if (scheduled.some((window) => window.start.getTime() <= requiredAt && window.end.getTime() > requiredAt))
                return null;
        }
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
        .filter((assistant) => Boolean(assistant))
        .sort((left, right) => left.candidateStartAt.getTime() - right.candidateStartAt.getTime() ||
        Number(left.futureScheduledCount || 0) - Number(right.futureScheduledCount || 0) ||
        left.assistantId.localeCompare(right.assistantId))[0] ?? null;
}
async function selectScheduleAssistantForSlot(db, input) {
    const slotStart = scheduleSlotDate(input.scheduledDate, input.scheduledTime);
    if (!slotStart)
        return null;
    const now = new Date();
    const earliestAllowedStart = addMinutes(now, input.etaMinutes ?? 0);
    // The availability response and confirmation request are separate calls. Keep
    // a small boundary tolerance so a slot shown as available is not rejected
    // merely because the confirmation arrived a few seconds later.
    const scheduleBoundaryToleranceMs = 60_000;
    if (slotStart.getTime() + scheduleBoundaryToleranceMs < earliestAllowedStart.getTime())
        return null;
    const initiateMinutes = Math.max(0, Math.round(Number(input.initiateMinutes || 0)));
    const capacityMinutes = initiateMinutes + Math.max(1, Math.round(Number(input.durationMinutes || 30)))
        + Math.max(0, Math.round(Number(input.wrapUpMinutes || 0)))
        + Math.max(0, Math.round(Number(input.travelBufferMinutes || 0)));
    const slotEnd = addMinutes(slotStart, capacityMinutes);
    return selectAssistantForCapacityWindow(db, {
        clusterId: input.clusterId,
        slotStart,
        slotEnd,
        scheduledDate: input.scheduledDate,
        latestStartAt: slotStart,
        durationMinutes: capacityMinutes,
        // Schedule availability is based on future capacity, not current online
        // presence. An offline assistant can still be selected for a future slot.
        allowedStatusCodes: ["available", "online", "active", "working", "offline"]
    });
}
export async function getBookingAvailabilityDecision(input) {
    await ensureBookingEngineSchema();
    const resolvedConfig = await resolveBookingAvailabilityConfig(pool, {
        clusterId: input.clusterId,
        serviceId: input.serviceId ?? null,
        categoryId: input.categoryId ?? null
    });
    const engineSettings = await getBookingEngineSetting();
    const { settings, scheduleType, effectiveConfig, bookingMode, assignType } = resolvedConfig;
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
    const isServiceOpenByEngine = bookingEngineRuleOpen(resolvedBookingEngineRule, now, { requireRule: true });
    const engineAssignmentMode = resolvedBookingEngineRule?.assistantAssignmentMode === "auto" ? "auto" : resolvedBookingEngineRule?.assistantAssignmentMode === "manual" ? "manual" : (assignType === "automate" ? "auto" : "manual");
    const instantEtaMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantEtaMinutes ?? engineSettings.instantAutoMaxWaitMinutes ?? 45)));
    const instantInitiateMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantInitiateMinutes ?? 0)));
    const instantWrapUpMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantWrapUpMinutes ?? 0)));
    const instantTravelMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantTravelMinutes ?? 0)));
    const scheduleEtaMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleEtaMinutes ?? 0)));
    const scheduleInitiateMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleInitiateMinutes ?? 0)));
    const scheduleWrapUpMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleWrapUpMinutes ?? 0)));
    const scheduleTravelMinutes = Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleTravelMinutes ?? 0)));
    const assistants = await pool.query(`
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
        select max(window_end) as "busyFreeAt"
        from (
          select coalesce(
            sr.booking_available_at,
            case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
            case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
            sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
          ) as window_end
          from zigo.task_assignments ta
          join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
          where ta.assistant_id = a.id
            and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
            and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
            and coalesce(sr.booking_type, sr.metadata->>'bookingType', 'instant') <> 'schedule'
          union all
          select acr.reserved_until as window_end
          from zigo.assistant_capacity_reservations acr
          where acr.assistant_id = a.id
            and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
            and acr.reserved_until > now()
            and coalesce(acr.booking_type, 'instant') <> 'schedule'
        ) active_windows
      ) active_work on true
      left join lateral (
        select count(*) as "futureScheduledCount"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = a.id
          and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(
            sr.booking_date,
            case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
            sr.scheduled_at::date
          ) >= current_date
      ) future_schedule on true
      where u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and (a.current_cluster_id = $1::uuid or acm.cluster_id = $1::uuid)
      group by a.id, av.status_code, av.latitude, av.longitude, active_work."busyFreeAt", future_schedule."futureScheduledCount"
    `, [requiredClusterId]);
    const clusterAssistantPool = hasClusterMismatch
        ? []
        : assistants.rows
            .map((assistant) => ({ ...assistant, nextAvailableAt: assistant.busyFreeAt && assistant.busyFreeAt.getTime() > now.getTime() ? assistant.busyFreeAt : now }));
    const assistantPool = clusterAssistantPool.filter((assistant) => assistantOnlineStatusCodes.has(assistant.statusCode));
    const instantAssistantPool = assistantPool.filter((assistant) => assistant.nextAvailableAt.getTime() <= now.getTime()
        && !["working", "busy", "assigned", "in_progress"].includes(String(assistant.statusCode || "").toLowerCase()));
    const scheduleAssistantPool = assistantPool.length ? assistantPool : clusterAssistantPool;
    const scheduledByAssistant = new Map();
    if (assistantPool.length) {
        const activeSchedule = await pool.query(`
        select
          ta.assistant_id as "assistantId",
          coalesce(
            sr.booking_start_at,
            sr.scheduled_at,
            case
              when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
               and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
              then (sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time
              else null
            end
          ) as "startAt",
          coalesce(
            sr.booking_available_at,
            case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
            case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
            sr.booking_end_at,
            sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
            case
              when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
               and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
              then ((sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
              else null
            end
          ) as "endAt",
          sr.metadata->>'scheduledDate' as "scheduledDate",
          sr.metadata->>'scheduledTime' as "scheduledTime",
          coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = any($1::uuid[])
          and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(
            sr.booking_date,
            case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
            sr.scheduled_at::date
          ) >= $2::date
        union all
        select
          acr.assistant_id as "assistantId",
          acr.reserved_from as "startAt",
          acr.reserved_until as "endAt",
          acr.reserved_from::date::text as "scheduledDate",
          to_char(acr.reserved_from, 'HH24:MI') as "scheduledTime",
          greatest(1, ceil(extract(epoch from (acr.reserved_until - acr.reserved_from)) / 60)::int) as "durationMinutes"
        from zigo.assistant_capacity_reservations acr
        where acr.assistant_id = any($1::uuid[])
          and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
          and acr.reserved_until > now()
          and coalesce(acr.booking_type, 'schedule') = 'schedule'
          and acr.reserved_from::date >= $2::date
      `, [assistantPool.map((assistant) => assistant.assistantId), localDateText(new Date())]);
        for (const row of activeSchedule.rows) {
            const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
            if (!start)
                continue;
            const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
            if (end.getTime() <= Date.now())
                continue;
            if (!scheduledByAssistant.has(row.assistantId))
                scheduledByAssistant.set(row.assistantId, []);
            scheduledByAssistant.get(row.assistantId).push({ start, end });
        }
    }
    const activeUnassignedInstantDemand = hasClusterMismatch
        ? 0
        : Number((await pool.query(`
          select count(*)::int as count
          from zigo.service_requests sr
          where (
              sr.cluster_id = $1::uuid
              or (
                coalesce(sr.metadata->>'clusterId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                and (sr.metadata->>'clusterId')::uuid = $1::uuid
              )
              or (
                coalesce(sr.metadata->>'locationClusterId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                and (sr.metadata->>'locationClusterId')::uuid = $1::uuid
              )
              or exists (
                select 1
                from zigo.request_locations rl
                where rl.service_request_id = sr.id
                  and rl.cluster_id = $1::uuid
              )
            )
            and sr.accepted_assignment_id is null
            and sr.status_code in ('new', 'created', 'requested', 'open', 'initiated', 'payment_due', 'due', 'unpaid', 'payment_pending', 'pending_payment', 'paid', 'queued', 'pending', 'pending_assign', 'pending_assignment', 'awaiting_assignment', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
            and coalesce(sr.booking_type, sr.metadata->>'bookingType', 'instant') <> 'schedule'
            and coalesce(
              sr.booking_available_at,
              case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
              case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
              sr.created_at + ((coalesce(sr.duration_minutes, 30)::int + $2::int) || ' minutes')::interval
            ) > now()
        `, [requiredClusterId, instantWrapUpMinutes + instantTravelMinutes])).rows[0]?.count || 0);
    const rawOnlineFreeAssistantCount = instantAssistantPool.filter((assistant) => {
        if (assistant.nextAvailableAt.getTime() > now.getTime())
            return false;
        const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
        return !scheduled.some((window) => window.start.getTime() <= now.getTime() && window.end.getTime() > now.getTime());
    }).length;
    const onlineFreeAssistantCount = Math.max(0, rawOnlineFreeAssistantCount - activeUnassignedInstantDemand);
    const onlineAssistantCount = assistantPool.length;
    const workingAssistantCount = Math.max(0, onlineAssistantCount - onlineFreeAssistantCount);
    const configuredWaitWindowMinutes = 0;
    const instantStartAt = now;
    const instantLimitMinutes = instantEtaMinutes || engineSettings.instantAutoMaxWaitMinutes || 45;
    const instantCapacityStartAt = addMinutes(instantStartAt, instantLimitMinutes + instantInitiateMinutes);
    const instantCapacityDurationMinutes = durationMinutes + instantWrapUpMinutes + instantTravelMinutes;
    const instantCapacityEndAt = addMinutes(instantCapacityStartAt, instantCapacityDurationMinutes);
    const candidates = instantAssistantPool
        .map((assistant) => {
        const predictedReadyAt = assistant.nextAvailableAt.getTime() > now.getTime() ? assistant.nextAvailableAt : now;
        const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
        const isFreeNow = assistant.nextAvailableAt.getTime() <= now.getTime()
            && !scheduled.some((window) => window.start.getTime() <= now.getTime() && window.end.getTime() > now.getTime());
        const assistantReadyAt = assistantReadyAtForInstant({ requestAt: now, baseAvailableAt: predictedReadyAt, scheduledWindows: scheduled });
        const assistantFreeInMinutes = Math.max(0, Math.ceil((assistantReadyAt.getTime() - now.getTime()) / 60_000));
        const window = instantAssistantCapacityWindow({
            requestAt: now,
            baseAvailableAt: predictedReadyAt,
            etaMinutes: instantEtaMinutes,
            initiateMinutes: instantInitiateMinutes,
            maxReadyDelayMinutes: instantEtaMinutes,
            durationMinutes: instantCapacityDurationMinutes,
            scheduledWindows: scheduled
        });
        const candidateStartAt = window?.candidateStartAt ?? null;
        const baseStartAt = candidateStartAt ?? addMinutes(assistantReadyAt, instantEtaMinutes + instantInitiateMinutes);
        const availableInMinutes = minutesUntil(now, candidateStartAt);
        const fallbackAvailableInMinutes = minutesUntil(now, baseStartAt) ?? 0;
        return {
            ...assistant,
            predictedReadyAt,
            assistantReadyAt,
            assistantFreeInMinutes,
            candidateStartAt: baseStartAt,
            candidateEndAt: window?.candidateEndAt ?? null,
            isFreeNow,
            hasInstantCapacityWindow: Boolean(window),
            estimatedReachMinutes: fallbackAvailableInMinutes,
            waitMinutes: assistantFreeInMinutes,
            estimatedAssignMinutes: assistantFreeInMinutes,
            instantCapacityStartAt: baseStartAt,
            instantCapacityEndAt: window?.candidateEndAt ?? addMinutes(baseStartAt, instantCapacityDurationMinutes)
        };
    });
    const bestCandidateSource = candidates.some((candidate) => candidate.hasInstantCapacityWindow)
        ? candidates.filter((candidate) => candidate.hasInstantCapacityWindow)
        : candidates;
    const bestCandidate = bestCandidateSource.sort((left, right) => left.estimatedAssignMinutes - right.estimatedAssignMinutes ||
        left.candidateStartAt.getTime() - right.candidateStartAt.getTime() ||
        Number(left.futureScheduledCount || 0) - Number(right.futureScheduledCount || 0) ||
        left.assistantId.localeCompare(right.assistantId))[0] ?? null;
    const assistantNextAvailableAt = bestCandidate?.candidateStartAt ?? null;
    const nextOnlineAssistantAvailableAt = assistantNextAvailableAt;
    const assistantAvailableInMinutes = bestCandidate ? Math.max(0, Math.ceil((bestCandidate.candidateStartAt.getTime() - now.getTime()) / 60_000)) : null;
    const finalAssistantAvailableAt = assistantNextAvailableAt;
    const finalAssistantAvailableInMinutes = assistantAvailableInMinutes;
    const hasInstantMode = bookingMode === "instant" || bookingMode === "both";
    const hasScheduleMode = bookingMode === "schedule" || bookingMode === "both";
    const hasInstantFreeAssistantNow = onlineFreeAssistantCount > 0;
    const instantAllowed = Boolean(hasInstantMode
        && isServiceOpenByEngine
        && !hasClusterMismatch
        && hasInstantFreeAssistantNow
        && bestCandidate
        && bestCandidate.isFreeNow
        && bestCandidate.hasInstantCapacityWindow);
    const scheduleAllowed = Boolean(hasScheduleMode
        && !hasClusterMismatch
        && scheduleAssistantPool.length);
    const dates = scheduleDatesForConfig(scheduleType);
    const scheduleTimeSlots = (scheduleType.timeSlots || []).filter(Boolean).sort();
    const scheduleAvailableSlots = [];
    if (scheduleAssistantPool.length && dates.length && scheduleTimeSlots.length) {
        const requestedDurationMinutes = durationMinutes;
        const scheduleCapacityDurationMinutes = scheduleInitiateMinutes + requestedDurationMinutes + scheduleWrapUpMinutes + scheduleTravelMinutes;
        const earliestScheduleSlotStartAt = addMinutes(now, scheduleEtaMinutes);
        const blocked = await pool.query(`
        select distinct
          ta.assistant_id as "assistantId",
          coalesce(
            sr.booking_start_at,
            sr.scheduled_at,
            case
              when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
               and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
              then (sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time
              else null
            end
          ) as "startAt",
          coalesce(
            sr.booking_available_at,
            case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
            case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
            sr.booking_end_at,
            sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
            case
              when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
               and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
              then ((sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time) + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
              else null
            end
          ) as "endAt",
          sr.metadata->>'scheduledDate' as "scheduledDate",
          sr.metadata->>'scheduledTime' as "scheduledTime",
          coalesce(sr.duration_minutes, 30)::int as "durationMinutes"
        from zigo.task_assignments ta
        join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
        where ta.assistant_id = any($1::uuid[])
          and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
          and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
          and coalesce(sr.booking_type, sr.metadata->>'bookingType') = 'schedule'
          and coalesce(
            sr.booking_date,
            case when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (sr.metadata->>'scheduledDate')::date else null end,
            sr.scheduled_at::date
          )::text = any($2::text[])
        union all
        select distinct
          acr.assistant_id as "assistantId",
          acr.reserved_from as "startAt",
          acr.reserved_until as "endAt",
          acr.reserved_from::date::text as "scheduledDate",
          to_char(acr.reserved_from, 'HH24:MI') as "scheduledTime",
          greatest(1, ceil(extract(epoch from (acr.reserved_until - acr.reserved_from)) / 60)::int) as "durationMinutes"
        from zigo.assistant_capacity_reservations acr
        where acr.assistant_id = any($1::uuid[])
          and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
          and acr.reserved_until > now()
          and coalesce(acr.booking_type, 'schedule') = 'schedule'
          and acr.reserved_from::date::text = any($2::text[])
      `, [scheduleAssistantPool.map((assistant) => assistant.assistantId), dates.map((date) => date.value)]);
        const scheduledByAssistant = new Map();
        for (const row of blocked.rows) {
            const start = row.startAt ?? scheduleSlotDate(row.scheduledDate || "", row.scheduledTime || "");
            if (!start)
                continue;
            const end = row.endAt ?? new Date(start.getTime() + Math.max(1, Number(row.durationMinutes || 30)) * 60_000);
            if (!scheduledByAssistant.has(row.assistantId))
                scheduledByAssistant.set(row.assistantId, []);
            scheduledByAssistant.get(row.assistantId).push({ start, end });
        }
        for (const date of dates) {
            for (const time of scheduleTimeSlots) {
                const slotStart = scheduleSlotDate(date.value, time);
                if (!slotStart)
                    continue;
                if (slotStart.getTime() < earliestScheduleSlotStartAt.getTime())
                    continue;
                const slotEnd = addMinutes(slotStart, scheduleCapacityDurationMinutes);
                const availableAssistants = scheduleAssistantPool.filter((assistant) => {
                    const scheduled = scheduledByAssistant.get(assistant.assistantId) || [];
                    const predictedReadyAt = assistant.nextAvailableAt.getTime() > now.getTime()
                        ? assistant.nextAvailableAt
                        : now;
                    return Boolean(nextOpenCapacityWindow({
                        slotStart,
                        slotEnd,
                        baseAvailableAt: predictedReadyAt,
                        latestStartAt: slotStart,
                        durationMinutes: scheduleCapacityDurationMinutes,
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
        : !scheduleAssistantPool.length
            ? "no_cluster_assistant"
            : !hasScheduleCapacity
                ? "no_schedule_slots"
                : null;
    const instantSupplyUnavailable = Boolean(hasInstantMode && !hasClusterMismatch && isServiceOpenByEngine && !instantAllowed);
    const instantSupplyUnavailableReason = instantSupplyUnavailable
        ? (!assistantPool.length
            ? "no_cluster_assistant"
            : !onlineAssistantCount
                ? "no_online_assistant"
                : !onlineFreeAssistantCount
                    ? "no_free_assistant"
                    : "no_instant_capacity")
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
        supplyAvailable: instantAllowed,
        supplyUnavailable: instantSupplyUnavailable,
        supplyUnavailableReason: instantSupplyUnavailableReason,
        autoHideUnavailable: instantSupplyUnavailable,
        instantSupplyUnavailable,
        instantSupplyUnavailableReason,
        scheduleAllowed: scheduleAllowed && hasScheduleCapacity,
        instantAvailable: instantAllowed,
        estimatedReachMinutes: bestCandidate?.estimatedReachMinutes ?? settings.averageReachMinutes,
        instantEstimatedAssignMinutes: bestCandidate?.estimatedAssignMinutes ?? null,
        instantWaitMinutes: bestCandidate?.waitMinutes ?? null,
        instantWaitLimitMinutes: instantLimitMinutes,
        instantCapacityStartAt: (bestCandidate?.instantCapacityStartAt ?? instantCapacityStartAt).toISOString(),
        instantCapacityEndAt: (bestCandidate?.instantCapacityEndAt ?? instantCapacityEndAt).toISOString(),
        instantCapacityDurationMinutes,
        availabilityControls: {
            instantEtaMinutes,
            instantInitiateMinutes,
            instantWrapUpMinutes,
            instantTravelMinutes,
            scheduleEtaMinutes,
            scheduleInitiateMinutes,
            scheduleWrapUpMinutes,
            scheduleTravelMinutes,
            serviceOpen: isServiceOpenByEngine,
            instantServiceOpen: isServiceOpenByEngine,
            scheduleServiceOpen: true
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
function recordFromUnknown(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function stringFromUnknown(value, fallback = "") {
    return typeof value === "string" ? value.trim() || fallback : fallback;
}
function booleanFromUnknown(value, fallback = false) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return ["true", "1", "yes"].includes(value.trim().toLowerCase());
    if (typeof value === "number")
        return value === 1;
    return fallback;
}
function bookingRouteLocationType(index, total) {
    if (total <= 1)
        return "customer_selected";
    if (index === 0)
        return "start_point";
    if (index === total - 1)
        return "end_point";
    return "stop_point";
}
function bookingLocationStopsFromMetadata(metadata, fallback) {
    const bookingLocations = recordFromUnknown(metadata?.bookingLocations);
    const rawStops = Array.isArray(bookingLocations?.stops) ? bookingLocations.stops : [];
    const stops = rawStops
        .map((rawStop, index) => {
        const stop = recordFromUnknown(rawStop);
        if (!stop)
            return null;
        const address = stringFromUnknown(stop.address, stringFromUnknown(stop.addressText, ""));
        if (!address)
            return null;
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
        .filter((stop) => Boolean(stop))
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
    if (stops.length)
        return stops;
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
function bookingLocationsMetadata(metadata, stops) {
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
function normalizeBookingCartItems(metadata) {
    const cartItems = Array.isArray(metadata?.cartItems) ? metadata?.cartItems : [];
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
function uploadDetailsFromMetadata(metadata) {
    const uploads = Array.isArray(metadata?.uploads) ? metadata?.uploads : [];
    return uploads.map((item) => {
        if (!item || typeof item !== "object") {
            return { url: String(item || ""), name: null, type: null };
        }
        const upload = item;
        return {
            url: typeof upload.url === "string" ? upload.url : typeof upload.previewUrl === "string" ? upload.previewUrl : "",
            name: typeof upload.name === "string" ? upload.name : null,
            type: typeof upload.type === "string" ? upload.type : null
        };
    }).filter((item) => Boolean(item.url));
}
export async function createBookingByAdmin(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureBookingEngineSchema(client);
        const customer = await client.query(`
        select c.id, u.display_name, u.phone, u.email::text as email, coalesce(u.metadata->>'accountStatus', 'active') as status
        from zigo.customers c
        join zigo.users u on u.id = c.user_id
        where c.id = $1::uuid and u.deleted_at is null
      `, [input.customerId]);
        if (!customer.rows[0])
            throw new HttpError(400, "Selected customer was not found.");
        if (customer.rows[0].status !== "active")
            throw new HttpError(400, `Customer "${customer.rows[0].display_name || input.customerId}" is not active. Activate the customer before creating booking.`);
        const serviceId = input.serviceId ?? (await getDefaultServiceId(client));
        if (!serviceId)
            throw new HttpError(400, "No active Service found. Create/activate a Service before creating booking.");
        const serviceRow = await client.query(`
        select id, name, code
        from zigo.services
        where id = $1::uuid
        limit 1
      `, [serviceId]);
        const primaryCategoryId = input.categoryId ?? null;
        const categoryRow = primaryCategoryId ? await client.query(`
        select id, name, code
        from zigo.categories
        where id = $1::uuid
        limit 1
      `, [primaryCategoryId]) : { rows: [] };
        const inputMetadata = input.metadata ?? {};
        const cartItems = normalizeBookingCartItems(inputMetadata);
        const cartItemsSellingPaise = Math.max(0, Math.round(cartItems.reduce((sum, item) => sum + Number(item.sellingPricePaise || 0), 0)));
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
        if (!isScheduleBooking && !bookingEngineRuleOpen(resolvedBookingEngineRule, new Date(), { requireRule: true })) {
            throw new HttpError(400, "Instant booking is not accepting bookings right now. Please choose Schedule.");
        }
        const bookingEngineTiming = isScheduleBooking
            ? {
                etaMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleEtaMinutes ?? 0))),
                initiateMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleInitiateMinutes ?? 0))),
                wrapUpMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleWrapUpMinutes ?? 0))),
                travelBufferMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.scheduleTravelMinutes ?? 0)))
            }
            : {
                etaMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantEtaMinutes ?? engineSettings.instantAutoMaxWaitMinutes ?? 0))),
                initiateMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantInitiateMinutes ?? 0))),
                wrapUpMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantWrapUpMinutes ?? 0))),
                travelBufferMinutes: Math.max(0, Math.round(Number(resolvedBookingEngineRule?.instantTravelMinutes ?? 0)))
            };
        const assignmentMode = resolvedAvailabilityConfig.assignType;
        const scheduledDate = typeof inputMetadata.scheduledDate === "string" ? inputMetadata.scheduledDate : "";
        const scheduledTime = typeof inputMetadata.scheduledTime === "string" ? inputMetadata.scheduledTime : "";
        const instantStartAt = new Date();
        const requestNumber = await createUniqueBookingRequestNumber(client, {
            preferred: inputMetadata.requestNumber || inputMetadata.bookingReference,
            bookingType: bookingTypeMode,
            serviceCode: serviceRow.rows[0]?.code,
            serviceName: serviceRow.rows[0]?.name || inputMetadata.serviceName,
            categoryCode: categoryRow.rows[0]?.code,
            categoryName: categoryRow.rows[0]?.name || inputMetadata.categoryName,
            now: instantStartAt
        });
        const scheduledSlotStart = isScheduleBooking ? scheduleSlotDate(scheduledDate, scheduledTime) : null;
        if (isScheduleBooking && !scheduledSlotStart)
            throw new HttpError(400, "Select a valid schedule date and time.");
        const scheduleBoundaryToleranceMs = 60_000;
        if (isScheduleBooking && scheduledSlotStart.getTime() + scheduleBoundaryToleranceMs < addMinutes(instantStartAt, bookingEngineTiming.etaMinutes).getTime()) {
            throw new HttpError(409, "Selected schedule slot is no longer available.");
        }
        const requestedWaitWindowMinutes = 0;
        const instantWaitLimitMinutes = bookingEngineTiming.etaMinutes || engineSettings.instantAutoMaxWaitMinutes || 45;
        const instantAssignmentStartAt = addMinutes(instantStartAt, instantWaitLimitMinutes + bookingEngineTiming.initiateMinutes);
        const instantCapacityDurationMinutes = normalizedDurationMinutes + bookingEngineTiming.wrapUpMinutes + bookingEngineTiming.travelBufferMinutes;
        const instantCapacityEndAt = addMinutes(instantAssignmentStartAt, instantCapacityDurationMinutes);
        const requestLocationStops = bookingLocationStopsFromMetadata(inputMetadata, {
            address: input.address,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null
        });
        const basePricePaise = Math.max(0, Math.round(cartItems.reduce((sum, item) => sum + Number(item.basePricePaise || 0), 0)
            || (pricingBreakdown?.baseAmount || 0) * 100));
        const discountPaise = Math.max(0, Math.round((cartItems.reduce((sum, item) => sum + Math.max(0, item.basePricePaise - item.sellingPricePaise), 0))
            || (pricingBreakdown?.discountAmount || 0) * 100));
        const sellingPricePaise = Math.max(0, Math.round(cartItems.reduce((sum, item) => sum + Number(item.sellingPricePaise || 0), 0)
            || (pricingBreakdown?.sellingAmount || 0) * 100));
        const persistedPricing = inputMetadata.pricingBreakdown && typeof inputMetadata.pricingBreakdown === "object" && !Array.isArray(inputMetadata.pricingBreakdown)
            ? inputMetadata.pricingBreakdown
            : {};
        const persistedTaxRows = (Array.isArray(persistedPricing.taxRows) ? persistedPricing.taxRows : [])
            .filter((row) => Boolean(row) && typeof row === "object" && !Array.isArray(row))
            .map((row) => ({
            ...row,
            applicability: String(row.applicability || "exclusive").toLowerCase() === "inclusive" ? "inclusive" : "exclusive",
            amountPaise: Math.max(0, Math.round(Number(row.amountPaise || 0)))
        }));
        const persistedTaxRowTotal = persistedTaxRows.reduce((sum, row) => sum + row.amountPaise, 0);
        const inclusiveTaxAmountPaise = persistedTaxRows.length
            ? persistedTaxRows.filter((row) => row.applicability === "inclusive").reduce((sum, row) => sum + row.amountPaise, 0)
            : Math.max(0, Math.round(Number(persistedPricing.inclusiveTaxAmountPaise || 0)));
        const exclusiveTaxAmountPaise = persistedTaxRows.length
            ? persistedTaxRows.filter((row) => row.applicability === "exclusive").reduce((sum, row) => sum + row.amountPaise, 0)
            : Math.max(0, Math.round(Number(persistedPricing.exclusiveTaxAmountPaise || 0)));
        const taxAmountPaise = persistedTaxRows.length
            ? persistedTaxRowTotal
            : Math.max(0, Math.round(Number(persistedPricing.taxAmountPaise || inclusiveTaxAmountPaise + exclusiveTaxAmountPaise)));
        const itemTotalPaise = Math.max(0, sellingPricePaise - Math.min(sellingPricePaise, inclusiveTaxAmountPaise));
        const tipAmountPaise = Math.max(0, Math.min(100_000, Math.round(Number(persistedPricing.tipAmountPaise || inputMetadata.tipAmountPaise || 0))));
        const waitingChargesPaise = Math.max(0, Math.round(Number(persistedPricing.waitingChargesPaise || inputMetadata.waitingChargesPaise || 0)));
        const grandTotalPaise = Math.max(0, sellingPricePaise + exclusiveTaxAmountPaise + tipAmountPaise + waitingChargesPaise);
        const billingSnapshot = {
            categoryPriceRuleId: persistedPricing.categoryPriceRuleId || null,
            baseAmountPaise: basePricePaise,
            basePricePaise,
            discountAmountPaise: discountPaise,
            discountPaise,
            discountType: String(persistedPricing.discountType || "none"),
            discountValue: Math.max(0, Number(persistedPricing.discountValue || 0)),
            discountDetails: persistedPricing.discountDetails || {
                type: String(persistedPricing.discountType || "none"),
                value: Math.max(0, Number(persistedPricing.discountValue || 0)),
                amountPaise: discountPaise
            },
            sellingAmountPaise: sellingPricePaise,
            sellingPricePaise,
            itemTotalPaise,
            taxAmountPaise,
            inclusiveTaxAmountPaise,
            exclusiveTaxAmountPaise,
            tipAmountPaise,
            tipDetails: persistedPricing.tipDetails || {
                amountPaise: tipAmountPaise,
                source: "booking_confirmation"
            },
            waitingChargesPaise,
            grandTotalPaise,
            totalAmountPaise: grandTotalPaise,
            taxRows: persistedTaxRows
        };
        const paymentType = String(inputMetadata.paymentType || "cash").toLowerCase();
        const paymentStatus = String(inputMetadata.paymentStatus || (paymentType === "cash" ? "due" : "due")).toLowerCase();
        const isPaid = paymentStatus === "paid" || paymentStatus === "success" || paymentStatus === "captured" || paymentStatus === "completed";
        const paymentAmountPaise = grandTotalPaise;
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
            itemTotalPaise,
            taxAmountPaise,
            inclusiveTaxAmountPaise,
            exclusiveTaxAmountPaise,
            tipAmountPaise,
            grandTotalPaise,
            taxRows: persistedTaxRows,
            pricingBreakdown: billingSnapshot,
            waitingTimeMinutes: 0,
            waitingChargesPaise
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
        const selectedAssistant = isScheduleBooking
            ? await selectScheduleAssistantForSlot(client, {
                clusterId: input.clusterId,
                scheduledDate,
                scheduledTime,
                durationMinutes: normalizedDurationMinutes,
                etaMinutes: bookingEngineTiming.etaMinutes,
                initiateMinutes: bookingEngineTiming.initiateMinutes,
                wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
                travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
            })
            : await selectAssistantForCapacityWindow(client, {
                clusterId: input.clusterId,
                slotStart: instantAssignmentStartAt,
                slotEnd: instantCapacityEndAt,
                scheduledDate: localDateText(instantStartAt),
                latestStartAt: instantAssignmentStartAt,
                durationMinutes: instantCapacityDurationMinutes,
                instantRequestAt: instantStartAt,
                instantEtaMinutes: instantWaitLimitMinutes,
                instantInitiateMinutes: bookingEngineTiming.initiateMinutes,
                instantReadyByMinutes: instantWaitLimitMinutes
            });
        if (!selectedAssistant) {
            if (!isScheduleBooking) {
                const nextAssistant = await selectAssistantForCapacityWindow(client, {
                    clusterId: input.clusterId,
                    slotStart: instantAssignmentStartAt,
                    slotEnd: instantCapacityEndAt,
                    scheduledDate: localDateText(instantStartAt),
                    latestStartAt: new Date(instantStartAt.getTime() + 7 * 24 * 60 * 60_000),
                    durationMinutes: instantCapacityDurationMinutes
                });
                if (nextAssistant?.candidateStartAt) {
                    const availableInMinutes = Math.max(0, Math.ceil((nextAssistant.candidateStartAt.getTime() - instantStartAt.getTime()) / 60_000));
                    const parts = [`Assistant will be available in ${shortDurationLabel(availableInMinutes)}.`];
                    if (availableInMinutes > 0) {
                        parts.push(`Next availability ${shortDurationLabel(availableInMinutes)}.`);
                    }
                    parts.push("To wait so much time, please go with schedule booking.");
                    throw new HttpError(409, parts.join(" "));
                }
            }
            throw new HttpError(409, isScheduleBooking ? "Selected schedule slot is no longer available." : "No online assistant capacity is available for instant booking.");
        }
        const assignmentStartAt = isScheduleBooking
            ? addMinutes(scheduleSlotDate(scheduledDate, scheduledTime), bookingEngineTiming.initiateMinutes)
            : selectedAssistant.candidateStartAt;
        if (!assignmentStartAt)
            throw new HttpError(400, "Booking start time is invalid.");
        const bookingWorkEndAt = addMinutes(assignmentStartAt, normalizedDurationMinutes);
        const bookingAvailableAt = addMinutes(bookingWorkEndAt, bookingEngineTiming.wrapUpMinutes + bookingEngineTiming.travelBufferMinutes);
        const expectedFreeAt = bookingAvailableAt;
        const instantAssignWaitMinutes = isScheduleBooking ? 0 : Math.max(0, Math.ceil((assignmentStartAt.getTime() - instantStartAt.getTime()) / 60_000));
        const serviceScheduledAt = isScheduleBooking ? assignmentStartAt : null;
        const requestMetadata = {
            createdByAdmin: true,
            actorUserId: input.actorUserId,
            ...(pricingBreakdown ? { pricingBreakdown } : {}),
            ...inputMetadata,
            pricingBreakdown: billingSnapshot,
            basePricePaise,
            discountPaise,
            sellingPricePaise,
            itemTotalPaise,
            taxAmountPaise,
            inclusiveTaxAmountPaise,
            exclusiveTaxAmountPaise,
            tipAmountPaise,
            grandTotalPaise,
            bookingLocations: bookingLocationsMetadata(inputMetadata, requestLocationStops),
            requestNumber,
            bookingReference: requestNumber,
            bookingType: bookingTypeMode,
            assignmentMode,
            ...(assignmentMode === "automate" && !isScheduleBooking ? { instantAssignWaitMinutes, instantWaitLimitMinutes } : {}),
            bookingStartAt: assignmentStartAt.toISOString(),
            bookingEndAt: bookingWorkEndAt.toISOString(),
            bookingAvailableAt: bookingAvailableAt.toISOString(),
            taskEndAt: bookingWorkEndAt.toISOString(),
            expectedFreeAt: expectedFreeAt.toISOString(),
            etaMinutes: bookingEngineTiming.etaMinutes,
            initiateMinutes: bookingEngineTiming.initiateMinutes,
            wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
            travelBufferMinutes: bookingEngineTiming.travelBufferMinutes,
            resolvedBookingEngineRule,
            ...(bookingMasterPricing ? { priceMasterQuote: bookingMasterPricing, priceMasterQuoteRecomputed: true } : {})
        };
        const initialStatusCode = assignmentMode === "automate" ? "assigned" : "payment_pending";
        const request = await client.query(`
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
        returning id, request_number as "requestNumber"
      `, [
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
                initiateMinutes: bookingEngineTiming.initiateMinutes,
                wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
                travelBufferMinutes: bookingEngineTiming.travelBufferMinutes,
                waitWindowMinutes: 0,
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
            0,
            waitingChargesPaise,
            paymentType,
            paymentStatus,
            isPaid,
            JSON.stringify(bookingPaymentDetails),
            JSON.stringify(requestLocationStops),
            JSON.stringify(uploadDetailsFromMetadata(inputMetadata)),
            JSON.stringify(requestMetadata)
        ]);
        await client.query(`
        insert into zigo.booking_billing_snapshots
          (service_request_id, base_price_paise, discount_paise, selling_price_paise,
           item_total_paise, tax_amount_paise, inclusive_tax_amount_paise,
           exclusive_tax_amount_paise, tip_amount_paise, waiting_charges_paise,
           grand_total_paise, currency, tax_details, pricing_details)
        values
          ($1::uuid, $2::bigint, $3::bigint, $4::bigint,
           $5::bigint, $6::bigint, $7::bigint,
           $8::bigint, $9::bigint, $10::bigint,
           $11::bigint, 'INR', $12::jsonb, $13::jsonb)
        on conflict (service_request_id) do update
        set base_price_paise = excluded.base_price_paise,
            discount_paise = excluded.discount_paise,
            selling_price_paise = excluded.selling_price_paise,
            item_total_paise = excluded.item_total_paise,
            tax_amount_paise = excluded.tax_amount_paise,
            inclusive_tax_amount_paise = excluded.inclusive_tax_amount_paise,
            exclusive_tax_amount_paise = excluded.exclusive_tax_amount_paise,
            tip_amount_paise = excluded.tip_amount_paise,
            waiting_charges_paise = excluded.waiting_charges_paise,
            grand_total_paise = excluded.grand_total_paise,
            currency = excluded.currency,
            tax_details = excluded.tax_details,
            pricing_details = excluded.pricing_details,
            updated_at = now()
      `, [
            request.rows[0].id,
            basePricePaise,
            discountPaise,
            sellingPricePaise,
            itemTotalPaise,
            taxAmountPaise,
            inclusiveTaxAmountPaise,
            exclusiveTaxAmountPaise,
            tipAmountPaise,
            waitingChargesPaise,
            grandTotalPaise,
            JSON.stringify(persistedTaxRows),
            JSON.stringify(billingSnapshot)
        ]);
        const serviceRequestUpdate = await client.query(`
        update zigo.service_requests
        set booking_start_at = $2::timestamptz,
            booking_end_at = $3::timestamptz,
            booking_available_at = $4::timestamptz,
            eta_minutes = $5::int,
            initiate_minutes = $6::int,
            wrap_up_minutes = $7::int,
            travel_buffer_minutes = $8::int,
            updated_at = now()
        where id = $1::uuid
      `, [
            request.rows[0].id,
            assignmentStartAt,
            bookingWorkEndAt,
            bookingAvailableAt,
            bookingEngineTiming.etaMinutes,
            bookingEngineTiming.initiateMinutes,
            bookingEngineTiming.wrapUpMinutes,
            bookingEngineTiming.travelBufferMinutes
        ]);
        for (const stop of requestLocationStops) {
            await client.query(`
          insert into zigo.request_locations
            (service_request_id, sequence, location_type, name, address, latitude, longitude, cluster_id, metadata)
           values ($1::uuid, $2::int, $3::text, $4::text, $5::text, $6::double precision, $7::double precision, $8::uuid, $9::jsonb)
        `, [
                request.rows[0].id,
                stop.sequence,
                stop.locationType,
                stop.label,
                stop.address,
                stop.latitude,
                stop.longitude,
                stop.clusterId || input.clusterId,
                JSON.stringify({ ...stop.metadata, createdByAdmin: true })
            ]);
        }
        let capacityAssignment = null;
        const capacityStatusCode = assignmentMode === "automate" ? "offered" : "reserved";
        const capacitySource = assignmentMode === "automate" ? "booking_auto_assignment" : "booking_capacity_reservation";
        const capacitySlotStart = isScheduleBooking ? scheduledSlotStart : instantStartAt;
        const capacityExpiresAt = expectedFreeAt;
        if (!capacityExpiresAt)
            throw new HttpError(400, "Booking start time is invalid.");
        const assignment = await client.query(`
          insert into zigo.task_assignments
            (request_id, service_request_id, assistant_id, status_code, expires_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
          values ($1::uuid, $1::uuid, $2::uuid, $3::text, $4::timestamptz, $5::text, $6::uuid, $6::uuid, $7::jsonb)
          returning id
        `, [
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
                reservedFrom: capacitySlotStart.toISOString(),
                startsAt: assignmentStartAt.toISOString(),
                taskEndAt: bookingWorkEndAt.toISOString(),
                bookingAvailableAt: bookingAvailableAt.toISOString(),
                expectedFreeAt: expectedFreeAt?.toISOString(),
                etaMinutes: bookingEngineTiming.etaMinutes,
                initiateMinutes: bookingEngineTiming.initiateMinutes,
                wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
                travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
            })
        ]);
        capacityAssignment = { id: assignment.rows[0].id, assistantId: selectedAssistant.assistantId, statusCode: capacityStatusCode };
        const promisedStartAt = assignmentStartAt;
        const slaDeadlineAt = new Date(promisedStartAt.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
        const reservation = await upsertCapacityReservation(client, {
            serviceRequestId: request.rows[0].id,
            assignmentId: assignment.rows[0].id,
            assistantId: selectedAssistant.assistantId,
            clusterId: input.clusterId,
            bookingType: bookingTypeMode,
            assignType: assignmentMode,
            statusCode: assignmentMode === "automate" ? "assigned" : "reserved",
            reservedFrom: capacitySlotStart,
            reservedUntil: expectedFreeAt,
            promisedStartAt,
            slaDeadlineAt,
            source: capacitySource,
            actorUserId: input.actorUserId,
            metadata: {
                taskAssignmentStatus: capacityStatusCode,
                scheduledDate: isScheduleBooking ? scheduledDate : localDateText(assignmentStartAt),
                scheduledTime: isScheduleBooking ? scheduledTime : localTimeText(assignmentStartAt),
                reservedFrom: capacitySlotStart.toISOString(),
                waitWindowMinutes: 0,
                durationMinutes: normalizedDurationMinutes,
                taskEndAt: bookingWorkEndAt.toISOString(),
                bookingAvailableAt: bookingAvailableAt.toISOString(),
                expectedFreeAt: expectedFreeAt.toISOString(),
                etaMinutes: bookingEngineTiming.etaMinutes,
                initiateMinutes: bookingEngineTiming.initiateMinutes,
                wrapUpMinutes: bookingEngineTiming.wrapUpMinutes,
                travelBufferMinutes: bookingEngineTiming.travelBufferMinutes
            }
        });
        await client.query(`
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
          where id = $1::uuid
        `, [
            request.rows[0].id,
            assignment.rows[0].id,
            expectedFreeAt.toISOString(),
            promisedStartAt.toISOString(),
            assignmentMode === "automate",
            slaDeadlineAt.toISOString(),
            reservation.id
        ]);
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
                waitWindowMinutes: 0,
                durationMinutes: normalizedDurationMinutes,
                taskEndAt: bookingWorkEndAt.toISOString(),
                bookingAvailableAt: bookingAvailableAt.toISOString(),
                expectedFreeAt: expectedFreeAt.toISOString(),
                etaMinutes: bookingEngineTiming.etaMinutes,
                initiateMinutes: bookingEngineTiming.initiateMinutes,
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
    }
    catch (error) {
        await client.query("rollback");
        if (error && typeof error === "object" && "code" in error) {
            const dbError = error;
            if (dbError.code === "42P18") {
                console.error("createBooking SQL parameter type error", {
                    userId: input?.actorUserId,
                    clusterId: input?.clusterId,
                    code: dbError.code,
                    error
                });
                throw new HttpError(400, "Unable to create booking with provided values.");
            }
            if (dbError.code === "23503") {
                throw new HttpError(404, "Unable to cancel booking due to missing reference records.");
            }
            if (dbError.code === "23505") {
                throw new HttpError(409, "Booking state changed while cancelling. Please refresh and try again.");
            }
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export async function getBookingPriceQuote(input) {
    return calculateClusterCategoryPricing(pool, input);
}
function isBookingMasterMetadata(metadata) {
    return Boolean(metadata && metadata.bookingMaster === true);
}
async function buildBookingMasterPriceQuote(input) {
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
function normalizeBookingMasterCartItems(value) {
    if (!Array.isArray(value))
        return [];
    const cartItems = [];
    for (const item of value) {
        if (!item || typeof item !== "object")
            continue;
        const row = item;
        const priceType = row.priceType === "time" ? "time" : "task";
        const categoryId = typeof row.categoryId === "string" && row.categoryId ? row.categoryId : null;
        if (!categoryId && priceType !== "time")
            continue;
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
    const result = await pool.query(`
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
    `);
    return result.rows;
}
async function ensureAssistantAvailableForBookingAssignment(db, input) {
    const eligibility = await listAssignableAssistantWindows(db, {
        serviceRequestId: input.serviceRequestId,
        assistantId: input.assistantId,
        forUpdate: true
    });
    const selected = eligibility.assistants.find((assistant) => assistant.assistantId === input.assistantId);
    if (!selected) {
        throw new HttpError(409, "Assistant is not eligible for this booking window.");
    }
    return {
        slotStart: eligibility.slotStart,
        taskEndAt: eligibility.taskEndAt,
        slotEnd: eligibility.slotEnd,
        durationMinutes: eligibility.durationMinutes,
        bufferMinutes: eligibility.bufferMinutes,
        clusterId: eligibility.clusterId,
        bookingType: eligibility.bookingType,
        metadata: eligibility.metadata,
        multiTaskOverride: false,
        overlappingAssignments: []
    };
}
async function bookingAssignmentWindow(db, serviceRequestId) {
    const booking = await db.query(`
      select
        id,
        cluster_id as "clusterId",
        coalesce(metadata, '{}'::jsonb) as metadata,
        coalesce(duration_minutes, 30)::int as "durationMinutes",
        coalesce(eta_minutes, 0)::int as "etaMinutes",
        coalesce(initiate_minutes, 0)::int as "initiateMinutes",
        coalesce(wrap_up_minutes, 0)::int as "wrapUpMinutes",
        coalesce(travel_buffer_minutes, 0)::int as "travelBufferMinutes",
        booking_start_at as "bookingStartAt",
        booking_end_at as "bookingEndAt",
        booking_available_at as "bookingAvailableAt"
      from zigo.service_requests
      where id = $1::uuid
    `, [serviceRequestId]);
    const row = booking.rows[0];
    if (!row)
        throw new HttpError(404, "Booking not found.");
    if (!row.clusterId)
        throw new HttpError(409, "Booking cluster is not set. Cannot assign assistant.");
    const now = new Date();
    const durationMinutes = Math.max(1, Math.min(1440, Math.round(Number(row.durationMinutes || 30))));
    const etaMinutes = Math.max(0, Math.round(Number(row.etaMinutes || row.metadata?.etaMinutes || 0)));
    const initiateMinutes = Math.max(0, Math.round(Number(row.initiateMinutes || row.metadata?.initiateMinutes || 0)));
    const wrapUpMinutes = Math.max(0, Math.round(Number(row.wrapUpMinutes || row.metadata?.wrapUpMinutes || 0)));
    const travelBufferMinutes = Math.max(0, Math.round(Number(row.travelBufferMinutes || row.metadata?.travelBufferMinutes || 0)));
    const persistedStartAt = row.bookingStartAt && !Number.isNaN(row.bookingStartAt.getTime()) ? row.bookingStartAt : null;
    const persistedTaskEndAt = row.bookingEndAt && !Number.isNaN(row.bookingEndAt.getTime()) ? row.bookingEndAt : null;
    const persistedAvailableAt = row.bookingAvailableAt && !Number.isNaN(row.bookingAvailableAt.getTime()) ? row.bookingAvailableAt : null;
    const slotStart = persistedStartAt ?? addMinutes(now, etaMinutes + initiateMinutes);
    const taskEndAt = persistedTaskEndAt ?? addMinutes(slotStart, durationMinutes);
    const slotEnd = persistedAvailableAt ?? addMinutes(taskEndAt, wrapUpMinutes + travelBufferMinutes);
    const bookingType = row.metadata?.bookingType === "schedule" ? "schedule" : "instant";
    return {
        clusterId: row.clusterId,
        bookingType,
        metadata: row.metadata,
        durationMinutes,
        bufferMinutes: wrapUpMinutes + travelBufferMinutes,
        slotStart,
        taskEndAt,
        slotEnd
    };
}
async function listAssignableAssistantWindows(db, input) {
    const window = await bookingAssignmentWindow(db, input.serviceRequestId);
    const assistants = await db.query(`
      select
        a.id as "assistantId",
        u.display_name as "displayName",
        a.assistant_code as "assistantCode",
        lower(coalesce(av.status_code, 'offline')) as "statusCode"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      left join zigo.assistant_availability av on av.assistant_id = a.id
      where u.deleted_at is null
        and coalesce(u.metadata->>'accountStatus', 'active') = 'active'
        and lower(coalesce(av.status_code, 'offline')) = any($2::text[])
        and ($3::uuid is null or a.id = $3::uuid)
        and (
          a.current_cluster_id = $1::uuid
          or exists (
            select 1
            from zigo.assistant_cluster_map acm
            where acm.assistant_id = a.id
              and acm.cluster_id = $1::uuid
              and coalesce(acm.is_active, true) = true
          )
        )
      ${input.forUpdate ? "for update of a" : ""}
    `, [window.clusterId, Array.from(assistantOnlineStatusCodes), input.assistantId ?? null]);
    if (!assistants.rows.length)
        return { ...window, assistants: [] };
    const activeAssignments = await db.query(`
      select
        ta.assistant_id as "assistantId",
        sr.id as "serviceRequestId",
        coalesce(
          sr.booking_start_at,
          sr.scheduled_at,
          case
            when coalesce(sr.metadata->>'scheduledDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
             and coalesce(sr.metadata->>'scheduledTime', '') ~ '^\d{2}:\d{2}'
            then (sr.metadata->>'scheduledDate')::date + left(sr.metadata->>'scheduledTime', 5)::time
            else null
          end,
          sr.created_at
        ) as "startAt",
        coalesce(
          sr.booking_available_at,
          case when coalesce(sr.metadata->>'bookingAvailableAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'bookingAvailableAt')::timestamptz else null end,
          case when coalesce(sr.metadata->>'expectedFreeAt', '') ~ '^\d{4}-\d{2}-\d{2}' then (sr.metadata->>'expectedFreeAt')::timestamptz else null end,
          sr.booking_end_at,
          sr.scheduled_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval,
          sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
        ) as "endAt",
        coalesce(sr.metadata, '{}'::jsonb) as metadata,
        coalesce(sr.duration_minutes, 30)::int as "durationMinutes",
        sr.created_at as "createdAt"
      from zigo.task_assignments ta
      join zigo.service_requests sr on (sr.id = ta.service_request_id or sr.id = ta.request_id)
      where ta.assistant_id = any($1::uuid[])
        and sr.id <> $2::uuid
        and ta.status_code in ('pending', 'reserved', 'offered', 'confirmed', 'processing', 'hold', 'on_hold', 'assigned', 'accepted', 'in_progress')
        and sr.status_code in ('payment_pending', 'paid', 'queued', 'pending', 'pending_assign', 'confirmed', 'processing', 'hold', 'on_hold', 'reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
      union all
      select
        acr.assistant_id as "assistantId",
        acr.service_request_id as "serviceRequestId",
        acr.reserved_from as "startAt",
        acr.reserved_until as "endAt",
        coalesce(acr.metadata, '{}'::jsonb) as metadata,
        greatest(1, ceil(extract(epoch from (acr.reserved_until - acr.reserved_from)) / 60)::int) as "durationMinutes",
        acr.created_at as "createdAt"
      from zigo.assistant_capacity_reservations acr
      where acr.assistant_id = any($1::uuid[])
        and acr.service_request_id <> $2::uuid
        and acr.status_code in ('held', 'pending', 'reserved', 'offered', 'confirmed', 'assigned', 'active')
        and acr.reserved_until > now()
    `, [assistants.rows.map((assistant) => assistant.assistantId), input.serviceRequestId]);
    const windowsByAssistant = new Map();
    for (const row of activeAssignments.rows) {
        const start = row.startAt ?? row.createdAt;
        const metadataExpectedFreeAt = typeof row.metadata?.expectedFreeAt === "string" ? new Date(row.metadata.expectedFreeAt) : null;
        const end = row.endAt
            ?? (metadataExpectedFreeAt && !Number.isNaN(metadataExpectedFreeAt.getTime()) ? metadataExpectedFreeAt : null)
            ?? addMinutes(start, Math.max(1, Math.round(Number(row.durationMinutes || 30))));
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
            continue;
        if (!windowsByAssistant.has(row.assistantId))
            windowsByAssistant.set(row.assistantId, []);
        windowsByAssistant.get(row.assistantId).push({ start, end });
    }
    const eligible = assistants.rows
        .map((assistant) => {
        const activeWindows = windowsByAssistant.get(assistant.assistantId) || [];
        const hasOverlap = activeWindows.some((activeWindow) => activeBookingWindowOverlaps(window.slotStart, window.slotEnd, activeWindow.start, activeWindow.end));
        if (hasOverlap)
            return null;
        const nextAvailableAt = activeWindows.reduce((latest, activeWindow) => {
            if (activeWindow.end.getTime() > latest.getTime() && activeWindow.end.getTime() <= window.slotStart.getTime())
                return activeWindow.end;
            return latest;
        }, new Date());
        return {
            assistantId: assistant.assistantId,
            nextAvailableAt: nextAvailableAt.toISOString(),
            assignmentWindowStartAt: window.slotStart.toISOString(),
            assignmentWindowEndAt: window.slotEnd.toISOString(),
            taskEndAt: window.taskEndAt.toISOString()
        };
    })
        .filter((assistant) => Boolean(assistant))
        .sort((left, right) => new Date(left.nextAvailableAt).getTime() - new Date(right.nextAvailableAt).getTime() || left.assistantId.localeCompare(right.assistantId));
    return { ...window, assistants: eligible };
}
export async function listAssignableAssistantsForBooking(serviceRequestId) {
    await ensureBookingEngineSchema();
    const result = await listAssignableAssistantWindows(pool, { serviceRequestId });
    return {
        bookingType: result.bookingType,
        assignmentWindowStartAt: result.slotStart.toISOString(),
        assignmentWindowEndAt: result.slotEnd.toISOString(),
        taskEndAt: result.taskEndAt.toISOString(),
        durationMinutes: result.durationMinutes,
        bufferMinutes: result.bufferMinutes,
        assistants: result.assistants
    };
}
export async function assignBooking(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureBookingEngineSchema(client);
        const engineSettings = await getBookingEngineSetting(client);
        const availability = await ensureAssistantAvailableForBookingAssignment(client, input);
        if (!availability?.slotStart || Number.isNaN(availability.slotStart.getTime())) {
            throw new HttpError(409, "Assistant availability start time is invalid.");
        }
        if (!availability?.taskEndAt || Number.isNaN(availability.taskEndAt.getTime())) {
            throw new HttpError(409, "Assistant availability task end time is invalid.");
        }
        if (!availability?.slotEnd || Number.isNaN(availability.slotEnd.getTime())) {
            throw new HttpError(409, "Assistant availability block end time is invalid.");
        }
        if (!availability?.clusterId) {
            throw new HttpError(409, "Booking cluster is not set. Cannot assign assistant.");
        }
        const slaDeadlineAt = new Date(availability.slotStart.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
        const nextCheckAt = new Date(Math.max(Date.now(), availability.slotStart.getTime() - Math.max(1, engineSettings.riskLookaheadMinutes || 15) * 60_000));
        await client.query(`
      update zigo.task_assignments
      set status_code = 'reassigned',
            admin_reason = $3::text,
            responded_at = now()
      where service_request_id = $1::uuid
          and status_code in ('reserved', 'offered', 'accepted')
          and assistant_id <> $2::uuid
      `, [input.serviceRequestId, input.assistantId, "Admin assignment selected another assistant."]);
        let assignment = await client.query(`
        update zigo.task_assignments
        set status_code = 'accepted',
            expires_at = $5::timestamptz,
            responded_at = coalesce(responded_at, now()),
            admin_reason = $3::text,
            assigned_by_user_id = $4::uuid,
            created_by_user_id = coalesce(created_by_user_id, $4::uuid),
            metadata = coalesce(metadata, '{}'::jsonb) || '{"source": "admin_panel_reserved_assignment", "autoAcceptedByAdminAssignment": true}'::jsonb
        where service_request_id = $1::uuid
          and assistant_id = $2::uuid
          and status_code in ('reserved', 'offered', 'accepted')
        returning id
      `, [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]);
        if (!assignment.rows[0]) {
            assignment = await client.query(`
        insert into zigo.task_assignments
            (request_id, service_request_id, assistant_id, status_code, expires_at, responded_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
          values ($1::uuid, $1::uuid, $2::uuid, 'accepted', $5::timestamptz, now(), $3::text, $4::uuid, $4::uuid, '{"source": "admin_panel", "autoAcceptedByAdminAssignment": true}'::jsonb)
          returning id
        `, [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]);
        }
        const assignmentId = assignment.rows[0]?.id;
        if (!assignmentId) {
            throw new HttpError(409, "Unable to save assignment. Please retry.");
        }
        await client.query(`
        update zigo.task_assignments
        set expires_at = $2::timestamptz,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
        where id = $1::uuid
        `, [
            assignmentId,
            availability.slotEnd,
            JSON.stringify({
                startsAt: availability.slotStart.toISOString(),
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                expectedFreeAt: availability.slotEnd.toISOString(),
                durationMinutes: availability.durationMinutes,
                bufferMinutes: availability.bufferMinutes
            })
        ]);
        await client.query(`
        update zigo.task_assignments
        set status_code = 'released',
            responded_at = now(),
            admin_reason = coalesce(admin_reason, 'Released during manual assignment')
        where service_request_id = $1::uuid
           and status_code in ('reserved', 'offered', 'accepted')
           and id <> $2::uuid
        `, [input.serviceRequestId, assignmentId]);
        const reservation = await upsertCapacityReservation(client, {
            serviceRequestId: input.serviceRequestId,
            assignmentId,
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
                bufferMinutes: availability.bufferMinutes,
                startsAt: availability.slotStart.toISOString(),
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                expectedFreeAt: availability.slotEnd.toISOString(),
                multiTaskOverride: availability.multiTaskOverride,
                overlappingAssignments: availability.overlappingAssignments
            }
        });
        if (!reservation?.id) {
            throw new HttpError(409, "Unable to reserve assistant capacity. Please retry.");
        }
        await releaseCapacityReservations(client, {
            serviceRequestId: input.serviceRequestId,
            exceptAssignmentId: assignmentId,
            statusCode: "replaced",
            reason: "Manual assignment selected another assistant."
        });
        const serviceRequestUpdate = await client.query(`
        update zigo.service_requests
        set status_code = 'accepted',
            accepted_assignment_id = $2::uuid,
            booking_start_at = $7::timestamptz,
            booking_end_at = $8::timestamptz,
            booking_available_at = $3::timestamptz,
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(coalesce(metadata, '{}'::jsonb), '{bookingStartAt}', to_jsonb($7::text), true),
                      '{bookingEndAt}', to_jsonb($8::text), true
                    ),
                    '{bookingAvailableAt}', to_jsonb($3::text), true
                  ),
                  '{expectedFreeAt}', to_jsonb($3::text), true
                ),
                '{promisedStartAt}', to_jsonb($4::text), true
              ),
              '{slaDeadlineAt}', to_jsonb($5::text), true
            )
            || jsonb_build_object('capacityReservationId', $6::text, 'taskEndAt', $8::text)
        where id = $1::uuid and status_code in ('payment_pending', 'queued', 'paid', 'assigned', 'accepted', 'hold', 'on_hold')
      `, [
            input.serviceRequestId,
            assignmentId,
            availability.slotEnd.toISOString(),
            availability.slotStart.toISOString(),
            slaDeadlineAt.toISOString(),
            reservation.id,
            availability.slotStart,
            availability.taskEndAt
        ]);
        if (serviceRequestUpdate.rowCount === 0) {
            throw new HttpError(409, "Booking is not in a state that can be assigned.");
        }
        await upsertBookingOrchestrationState(client, {
            serviceRequestId: input.serviceRequestId,
            clusterId: availability.clusterId,
            demandStatus: "accepted",
            riskStatus: "on_time",
            supplyStatus: "accepted",
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
                assignmentId,
                reason: input.reason,
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                multiTaskOverride: availability.multiTaskOverride,
                overlappingAssignments: availability.overlappingAssignments
            }
        });
        await writeAdminAction(client, input.actorUserId, input.serviceRequestId, "assign", input.reason, {
            assistantId: input.assistantId,
            assignmentId,
            multiTaskOverride: availability.multiTaskOverride,
            overlappingAssignments: availability.overlappingAssignments
        });
        await client.query("commit");
        return { ...assignment.rows[0], id: assignmentId };
    }
    catch (error) {
        await client.query("rollback");
        if (error && typeof error === "object" && "code" in error) {
            const dbError = error;
            if (dbError.code === "23505") {
                throw new HttpError(409, "Booking already has an active assignment. Please refresh and try again.");
            }
            if (dbError.code === "42P18") {
                console.error("assignBooking SQL parameter type error", {
                    serviceRequestId: input.serviceRequestId,
                    assistantId: input.assistantId,
                    code: dbError.code,
                    error
                });
                throw new HttpError(400, "Assignment data contains an invalid value. Please retry.");
            }
            if (dbError.code === "23503") {
                throw new HttpError(404, "Unable to link assignment to booking or assistant.");
            }
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export async function reassignBooking(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureBookingEngineSchema(client);
        const engineSettings = await getBookingEngineSetting(client);
        const availability = await ensureAssistantAvailableForBookingAssignment(client, input);
        if (!availability?.slotStart || Number.isNaN(availability.slotStart.getTime())) {
            throw new HttpError(409, "Assistant availability start time is invalid.");
        }
        if (!availability?.taskEndAt || Number.isNaN(availability.taskEndAt.getTime())) {
            throw new HttpError(409, "Assistant availability task end time is invalid.");
        }
        if (!availability?.slotEnd || Number.isNaN(availability.slotEnd.getTime())) {
            throw new HttpError(409, "Assistant availability block end time is invalid.");
        }
        if (!availability?.clusterId) {
            throw new HttpError(409, "Booking cluster is not set. Cannot assign assistant.");
        }
        const slaDeadlineAt = new Date(availability.slotStart.getTime() + Math.max(0, engineSettings.slaGraceMinutes ?? 10) * 60_000);
        const nextCheckAt = new Date(Math.max(Date.now(), availability.slotStart.getTime() - Math.max(1, engineSettings.riskLookaheadMinutes || 15) * 60_000));
        await client.query(`
      update zigo.task_assignments
      set status_code = 'reassigned',
            admin_reason = $3::text,
            responded_at = now()
      where service_request_id = $1::uuid
          and status_code in ('reserved', 'offered', 'accepted')
          and assistant_id <> $2::uuid
      `, [input.serviceRequestId, input.assistantId, input.reason]);
        let assignment = await client.query(`
        update zigo.task_assignments
        set status_code = 'accepted',
            expires_at = $5::timestamptz,
            responded_at = coalesce(responded_at, now()),
            admin_reason = $3::text,
            assigned_by_user_id = $4::uuid,
            created_by_user_id = coalesce(created_by_user_id, $4::uuid),
            metadata = coalesce(metadata, '{}'::jsonb) || '{"source": "admin_panel_reserved_assignment", "autoAcceptedByAdminAssignment": true}'::jsonb
        where service_request_id = $1::uuid
          and assistant_id = $2::uuid
          and status_code in ('reserved', 'offered', 'accepted')
        returning id
      `, [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]);
        if (!assignment.rows[0]) {
            assignment = await client.query(`
          insert into zigo.task_assignments
            (request_id, service_request_id, assistant_id, status_code, expires_at, responded_at, admin_reason, created_by_user_id, assigned_by_user_id, metadata)
            values ($1::uuid, $1::uuid, $2::uuid, 'accepted', $5::timestamptz, now(), $3::text, $4::uuid, $4::uuid, '{"source": "admin_panel", "autoAcceptedByAdminAssignment": true}'::jsonb)
            returning id
        `, [input.serviceRequestId, input.assistantId, input.reason, input.actorUserId, availability.slotEnd]);
        }
        const assignmentId = assignment.rows[0]?.id;
        if (!assignmentId) {
            throw new HttpError(409, "Unable to create reassigned booking assignment. Please retry.");
        }
        await client.query(`
        update zigo.task_assignments
        set expires_at = $2::timestamptz,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
        where id = $1::uuid
      `, [
            assignmentId,
            availability.slotEnd,
            JSON.stringify({
                startsAt: availability.slotStart.toISOString(),
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                expectedFreeAt: availability.slotEnd.toISOString(),
                durationMinutes: availability.durationMinutes,
                bufferMinutes: availability.bufferMinutes
            })
        ]);
        await releaseCapacityReservations(client, {
            serviceRequestId: input.serviceRequestId,
            exceptAssignmentId: null,
            statusCode: "replaced",
            reason: "Booking reassigned to another assistant."
        });
        const reservation = await upsertCapacityReservation(client, {
            serviceRequestId: input.serviceRequestId,
            assignmentId,
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
                bufferMinutes: availability.bufferMinutes,
                startsAt: availability.slotStart.toISOString(),
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                expectedFreeAt: availability.slotEnd.toISOString(),
                multiTaskOverride: availability.multiTaskOverride,
                overlappingAssignments: availability.overlappingAssignments
            }
        });
        const serviceRequestUpdate = await client.query(`
        update zigo.service_requests
        set status_code = 'accepted',
            accepted_assignment_id = $2::uuid,
            booking_start_at = $7::timestamptz,
            booking_end_at = $8::timestamptz,
            booking_available_at = $3::timestamptz,
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(coalesce(metadata, '{}'::jsonb), '{bookingStartAt}', to_jsonb($7::text), true),
                      '{bookingEndAt}', to_jsonb($8::text), true
                    ),
                    '{bookingAvailableAt}', to_jsonb($3::text), true
                  ),
                  '{expectedFreeAt}', to_jsonb($3::text), true
                ),
                '{promisedStartAt}', to_jsonb($4::text), true
              ),
              '{slaDeadlineAt}', to_jsonb($5::text), true
            )
            || jsonb_build_object('capacityReservationId', $6::text, 'taskEndAt', $8::text)
        where id = $1::uuid
      `, [
            input.serviceRequestId,
            assignmentId,
            availability.slotEnd.toISOString(),
            availability.slotStart.toISOString(),
            slaDeadlineAt.toISOString(),
            reservation.id,
            availability.slotStart,
            availability.taskEndAt
        ]);
        if (serviceRequestUpdate.rowCount === 0) {
            throw new HttpError(409, "Booking is not in a state that can be reassigned.");
        }
        await upsertBookingOrchestrationState(client, {
            serviceRequestId: input.serviceRequestId,
            clusterId: availability.clusterId,
            demandStatus: "accepted",
            riskStatus: "on_time",
            supplyStatus: "accepted",
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
                assignmentId,
                reason: input.reason,
                taskEndAt: availability.taskEndAt.toISOString(),
                bookingAvailableAt: availability.slotEnd.toISOString(),
                multiTaskOverride: availability.multiTaskOverride,
                overlappingAssignments: availability.overlappingAssignments
            }
        });
        await writeAdminAction(client, input.actorUserId, input.serviceRequestId, "reassign", input.reason, {
            assistantId: input.assistantId,
            assignmentId,
            multiTaskOverride: availability.multiTaskOverride,
            overlappingAssignments: availability.overlappingAssignments
        });
        await client.query("commit");
        return { ...assignment.rows[0], id: assignmentId };
    }
    catch (error) {
        await client.query("rollback");
        if (error && typeof error === "object" && "code" in error) {
            const dbError = error;
            if (dbError.code === "23505") {
                throw new HttpError(409, "Booking already has an active assignment. Please refresh and try again.");
            }
            if (dbError.code === "42P18") {
                console.error("reassignBooking SQL parameter type error", {
                    serviceRequestId: input.serviceRequestId,
                    assistantId: input.assistantId,
                    code: dbError.code,
                    error
                });
                throw new HttpError(400, "Reassignment data contains an invalid value. Please retry.");
            }
            if (dbError.code === "23503") {
                throw new HttpError(404, "Unable to link assignment to booking or assistant.");
            }
        }
        throw error;
    }
    finally {
        client.release();
    }
}
async function getDefaultServiceId(client) {
    const result = await client.query(`
      select id
      from zigo.services
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
      order by sort_order, name
      limit 1
    `);
    return result.rows[0]?.id ?? null;
}
export async function cancelBookingByAdmin(serviceRequestId, actorUserId, reason) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureBookingEngineSchema(client);
        const result = await client.query(`
        update zigo.service_requests
        set status_code = 'cancelled',
            cancelled_reason = $2::text
        where id = $1::uuid and status_code <> 'completed'
        returning id, cluster_id as "clusterId", coalesce(metadata, '{}'::jsonb) as metadata, accepted_assignment_id as "acceptedAssistantId"
      `, [serviceRequestId, reason]);
        if (result.rows[0]) {
            await client.query(`
          update zigo.task_assignments
          set status_code = 'cancelled',
              responded_at = coalesce(responded_at, now()),
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where service_request_id = $1::uuid
            and status_code not in ('completed', 'cancelled', 'canceled', 'rejected', 'released')
        `, [
                serviceRequestId,
                JSON.stringify({
                    cancelledBy: "admin",
                    cancellationReason: reason,
                    cancelledAt: new Date().toISOString()
                })
            ]);
            await releaseCapacityReservations(client, {
                serviceRequestId,
                statusCode: "cancelled",
                reason
            });
            const metadata = result.rows[0].metadata;
            let clusterId = result.rows[0].clusterId;
            if (!clusterId && result.rows[0].acceptedAssistantId) {
                const acceptedAssignment = await client.query(`select a.current_cluster_id as "clusterId"
             from zigo.task_assignments ta
              join zigo.assistants a on a.id = ta.assistant_id
              where ta.id = $1::uuid
              limit 1`, [result.rows[0].acceptedAssistantId]);
                clusterId = acceptedAssignment.rows[0]?.clusterId ?? null;
            }
            if (clusterId) {
                await upsertBookingOrchestrationState(client, {
                    serviceRequestId,
                    clusterId,
                    demandStatus: "cancelled",
                    riskStatus: "closed",
                    supplyStatus: "released",
                    bookingType: metadata?.bookingType === "schedule" ? "schedule" : "instant",
                    assignType: String(metadata?.assignmentMode || "manual"),
                    lastEventType: "booking.cancelled",
                    metadata: { reason }
                });
            }
            await writeAdminAction(client, actorUserId, serviceRequestId, "cancel", reason, {});
        }
        await client.query("commit");
        if (result.rows[0]) {
            await stopAssistantCalendarBlocksForBooking({ bookingId: serviceRequestId, status: "cancelled" }).catch((error) => {
                console.error("Unable to release assistant dispatch blocks for cancelled booking.", error);
            });
        }
        return result.rows[0] ?? null;
    }
    catch (error) {
        await client.query("rollback");
        if (error && typeof error === "object" && "code" in error) {
            const dbError = error;
            if (dbError.code === "42P18") {
                console.error("cancelBookingByAdmin SQL parameter error", {
                    serviceRequestId,
                    actorUserId,
                    code: dbError.code,
                    error
                });
                throw new HttpError(400, "Cancel data contains an invalid value.");
            }
            if (dbError.code === "23503") {
                throw new HttpError(404, "Unable to cancel booking due to missing reference records.");
            }
            if (dbError.code === "23505") {
                throw new HttpError(409, "Booking state changed while cancelling. Please refresh and try again.");
            }
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export async function confirmBookingPaymentByAdmin(serviceRequestId, actorUserId, input) {
    await ensureBookingEngineSchema();
    const client = await pool.connect();
    const response = input.response === "yes" ? "yes" : "no";
    const referenceId = input.referenceId?.trim() || "";
    const note = input.note?.trim() || "";
    const proofUrl = input.proofUrl?.trim() || "";
    try {
        await client.query("begin");
        const current = await client.query(`
        select id,
          payment_status as "paymentStatus",
          payment_type as "paymentType",
          payment_details as "paymentDetails",
          metadata,
          accepted_assignment_id as "acceptedAssignmentId",
          estimated_amount_paise as "estimatedAmountPaise",
          booking_amount_paise as "bookingAmountPaise"
        from zigo.service_requests
        where id = $1::uuid
        for update
      `, [serviceRequestId]);
        const booking = current.rows[0];
        if (!booking)
            throw new HttpError(404, "Booking not found.");
        const amountPaise = Number(booking.bookingAmountPaise ?? booking.estimatedAmountPaise ?? 0);
        const paymentDetails = {
            status: response === "yes" ? "paid" : "pending",
            mode: "upi",
            amountPaise,
            confirmedBy: "admin",
            adminResponse: response,
            adminConfirmedAt: new Date().toISOString(),
            referenceId,
            transactionId: referenceId,
            note,
            proofUrl,
            sourceUpdateId: input.sourceUpdateId || "",
            previousStatus: booking.paymentStatus || "pending"
        };
        const metadata = response === "yes"
            ? {
                paymentStatus: "paid",
                paymentType: "upi",
                paymentConfirmationStatus: "paid",
                paymentConfirmedBy: "admin",
                paymentConfirmedAt: paymentDetails.adminConfirmedAt,
                paymentReferenceId: referenceId,
                paymentProofUrl: proofUrl,
                paymentNote: note,
                chatLocked: true,
                inputLocked: true
            }
            : {
                paymentStatus: "pending",
                paymentType: "upi",
                paymentConfirmationStatus: "pending",
                paymentRejectedBy: "admin",
                paymentRejectedAt: paymentDetails.adminConfirmedAt,
                paymentRejectionNote: note
            };
        const updated = await client.query(`
        update zigo.service_requests
        set payment_type = 'upi',
            payment_status = case when $2::text = 'yes' then 'paid' else 'pending' end,
            is_paid = case when $2::text = 'yes' then true else coalesce(is_paid, false) end,
            payment_details = coalesce(payment_details, '{}'::jsonb) || $3::jsonb,
            metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
        where id = $1::uuid
        returning id, payment_status as "paymentStatus", payment_type as "paymentType", is_paid as "isPaid",
          payment_details as "paymentDetails", metadata
      `, [serviceRequestId, response, JSON.stringify(paymentDetails), JSON.stringify(metadata)]);
        await client.query(`
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1::uuid, $2::uuid, $3::uuid, 'admin', $4::text, $5::text, $6::jsonb, $7::jsonb)
      `, [
            serviceRequestId,
            booking.acceptedAssignmentId,
            actorUserId,
            response === "yes" ? "payment_received" : "payment_response",
            response === "yes" ? "Admin confirmed UPI payment received." : "Admin did not confirm UPI payment.",
            JSON.stringify(proofUrl ? [proofUrl] : []),
            JSON.stringify({
                ...paymentDetails,
                status: response === "yes" ? "paid" : "pending",
                confirmationTarget: "admin",
                source: "admin_payment_confirmation"
            })
        ]);
        await writeAdminAction(client, actorUserId, serviceRequestId, response === "yes" ? "confirm_payment" : "reject_payment_confirmation", note || "Admin payment confirmation", paymentDetails);
        await client.query("commit");
        return updated.rows[0];
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function forceCloseBooking(serviceRequestId, actorUserId, reason) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureBookingEngineSchema(client);
        const result = await client.query(`
        update zigo.service_requests
        set status_code = 'completed',
            completed_at = now(),
            metadata = metadata || jsonb_build_object('forceClosed', true, 'forceCloseReason', $2::text)
        where id = $1::uuid and status_code <> 'completed'
        returning id, cluster_id as "clusterId", coalesce(metadata, '{}'::jsonb) as metadata, accepted_assignment_id as "acceptedAssistantId"
      `, [serviceRequestId, reason]);
        if (result.rows[0]) {
            await releaseCapacityReservations(client, {
                serviceRequestId,
                statusCode: "completed",
                reason
            });
            const metadata = result.rows[0].metadata;
            let clusterId = result.rows[0].clusterId;
            if (!clusterId && result.rows[0].acceptedAssistantId) {
                const acceptedAssignment = await client.query(`select a.current_cluster_id as "clusterId"
              from zigo.task_assignments ta
              join zigo.assistants a on a.id = ta.assistant_id
              where ta.id = $1::uuid
              limit 1`, [result.rows[0].acceptedAssistantId]);
                clusterId = acceptedAssignment.rows[0]?.clusterId ?? null;
            }
            if (clusterId) {
                await upsertBookingOrchestrationState(client, {
                    serviceRequestId,
                    clusterId,
                    demandStatus: "completed",
                    riskStatus: "closed",
                    supplyStatus: "released",
                    bookingType: metadata?.bookingType === "schedule" ? "schedule" : "instant",
                    assignType: String(metadata?.assignmentMode || "manual"),
                    lastEventType: "booking.closed",
                    metadata: { reason }
                });
            }
            await writeAdminAction(client, actorUserId, serviceRequestId, "force_close", reason, {});
        }
        await client.query("commit");
        return result.rows[0] ?? null;
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function listCustomerDisputes(input = {}) {
    await ensureCustomerDisputeSchema();
    const page = Math.max(1, Number(input.page || 1));
    const pageSize = Math.max(5, Math.min(100, Number(input.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const status = String(input.status || "open").toLowerCase();
    const search = String(input.search || "").trim();
    const result = await pool.query(`
      with rows as (
        select
          cd.id,
          cd.service_request_id as "bookingId",
          sr.request_number as "bookingNumber",
          cd.status_code as "statusCode",
          cd.subject,
          cd.description,
          cd.request_refund as "requestRefund",
          cd.requested_refund_amount_paise as "requestedRefundAmountPaise",
          cd.payment_mode as "paymentMode",
          cd.resolution_type as "resolutionType",
          cd.resolution_amount_paise as "resolutionAmountPaise",
          cd.resolution_reason as "resolutionReason",
          cd.admin_response as "adminResponse",
          cd.created_at as "createdAt",
          cd.updated_at as "updatedAt",
          cd.resolved_at as "resolvedAt",
          cu.display_name as "customerName",
          cu.phone as "customerPhone",
          coalesce(sr.booking_amount_paise, sr.estimated_amount_paise, 0) as "bookingAmountPaise",
          sr.payment_type as "bookingPaymentType",
          sr.payment_status as "bookingPaymentStatus",
          count(*) over()::int as "totalRecords"
        from zigo.customer_disputes cd
        join zigo.service_requests sr on sr.id = cd.service_request_id
        left join zigo.customers c on c.user_id = cd.customer_user_id
        left join zigo.users cu on cu.id = cd.customer_user_id
        where ($1::text = 'all' or lower(cd.status_code) = $1::text)
          and (
            $2::text = ''
            or sr.request_number ilike '%' || $2::text || '%'
            or cd.subject ilike '%' || $2::text || '%'
            or cu.display_name ilike '%' || $2::text || '%'
            or cu.phone ilike '%' || $2::text || '%'
          )
      )
      select *
      from rows
      order by "updatedAt" desc, "createdAt" desc
      limit $3::int offset $4::int
    `, [status, search, pageSize, offset]);
    const bookingIds = result.rows.map((row) => row.bookingId).filter(Boolean);
    const updates = bookingIds.length
        ? await pool.query(`
        select service_request_id as "bookingId", actor_type as "actorType", update_type as "updateType",
          message, media_urls as "mediaUrls", metadata, created_at as "createdAt"
        from zigo.booking_task_updates
        where service_request_id = any($1::uuid[])
          and coalesce(metadata->>'disputeId', '') <> ''
        order by created_at asc
      `, [bookingIds])
        : { rows: [] };
    const byBooking = new Map();
    for (const update of updates.rows) {
        const list = byBooking.get(update.bookingId) || [];
        list.push(update);
        byBooking.set(update.bookingId, list);
    }
    const totalRecords = Number(result.rows[0]?.totalRecords || 0);
    return {
        data: result.rows.map((row) => {
            const { totalRecords: _totalRecords, ...dispute } = row;
            return { ...dispute, messages: byBooking.get(row.bookingId) || [] };
        }),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) }
    };
}
export async function addCustomerDisputeMessage(disputeId, actorUserId, message) {
    await ensureCustomerDisputeSchema();
    const client = await pool.connect();
    try {
        await client.query("begin");
        const dispute = await client.query(`
        update zigo.customer_disputes
        set assigned_admin_user_id = coalesce(assigned_admin_user_id, $2::uuid),
            updated_at = now()
        where id = $1::uuid
        returning id, service_request_id as "bookingId"
      `, [disputeId, actorUserId]);
        if (!dispute.rows[0])
            throw new HttpError(404, "Customer dispute not found.");
        const update = await client.query(`
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1::uuid, null, $2::uuid, 'admin', 'text', $3::text, '[]'::jsonb, $4::jsonb)
        returning id, created_at as "createdAt"
      `, [dispute.rows[0].bookingId, actorUserId, message, JSON.stringify({ disputeId, disputeAction: "admin_message" })]);
        await client.query("commit");
        return { ...update.rows[0], bookingId: dispute.rows[0].bookingId, disputeId };
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function resolveCustomerDispute(disputeId, actorUserId, input) {
    await ensureCustomerDisputeSchema();
    const client = await pool.connect();
    try {
        await client.query("begin");
        const result = await client.query(`
        update zigo.customer_disputes
        set status_code = 'resolved',
            resolution_type = $2::text,
            resolution_amount_paise = $3::int,
            resolution_reason = $4::text,
            admin_response = $5::text,
            resolved_at = now(),
            resolved_by_user_id = $6::uuid,
            assigned_admin_user_id = coalesce(assigned_admin_user_id, $6::uuid),
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $7::jsonb
        where id = $1::uuid
        returning id, service_request_id as "bookingId", status_code as "statusCode",
          resolution_type as "resolutionType", resolution_amount_paise as "resolutionAmountPaise",
          resolution_reason as "resolutionReason", admin_response as "adminResponse"
      `, [
            disputeId,
            input.resolutionType,
            Math.max(0, Math.round(Number(input.amountPaise || 0))),
            input.reason,
            input.adminResponse || "",
            actorUserId,
            JSON.stringify({ resolvedFrom: "admin_panel" })
        ]);
        if (!result.rows[0])
            throw new HttpError(404, "Customer dispute not found.");
        const row = result.rows[0];
        await client.query(`
        insert into zigo.booking_task_updates
          (service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata)
        values ($1::uuid, null, $2::uuid, 'admin', 'status', $3::text, '[]'::jsonb, $4::jsonb)
      `, [
            row.bookingId,
            actorUserId,
            input.adminResponse || `Dispute resolved: ${input.reason}`,
            JSON.stringify({
                disputeId,
                disputeAction: "resolved",
                resolutionType: input.resolutionType,
                resolutionAmountPaise: Math.max(0, Math.round(Number(input.amountPaise || 0))),
                resolutionReason: input.reason
            })
        ]);
        await client.query(`
        update zigo.service_requests
        set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        where id = $1::uuid
      `, [
            row.bookingId,
            JSON.stringify({
                lastDisputeId: disputeId,
                lastDisputeStatus: "resolved",
                lastDisputeResolutionType: input.resolutionType,
                lastDisputeResolutionAmountPaise: Math.max(0, Math.round(Number(input.amountPaise || 0)))
            })
        ]);
        await client.query("commit");
        return row;
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function getBookingReportActivity(bookingId) {
    const booking = await pool.query(`select id from zigo.service_requests where id = $1::uuid limit 1`, [bookingId]);
    if (!booking.rows[0])
        throw new HttpError(404, "Booking not found.");
    const updates = await pool.query(`
      select btu.id, btu.actor_type as "actorType", btu.update_type as "updateType",
        btu.message, btu.media_urls as "mediaUrls", btu.metadata,
        btu.task_assignment_id as "assignmentId", btu.created_at as "createdAt",
        u.display_name as "actorName"
      from zigo.booking_task_updates btu
      left join zigo.users u on u.id = btu.actor_user_id
      where btu.service_request_id = $1::uuid
      order by btu.created_at asc
    `, [bookingId]);
    return { updates: updates.rows };
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
async function writeAdminAction(client, actorUserId, serviceRequestId, actionType, reason, afterData) {
    await client.query(`
      insert into zigo.admin_actions
        (actor_user_id, entity_type, entity_id, notes, after_data)
      values ($1::uuid, 'service_request', $2::uuid, $3::text, $4::jsonb)
    `, [actorUserId, serviceRequestId, `${actionType}: ${reason}`, JSON.stringify(afterData)]);
}
