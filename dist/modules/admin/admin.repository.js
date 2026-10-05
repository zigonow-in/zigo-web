import { pool } from "../../db/pool.js";
const DASHBOARD_CACHE_MS = 60_000;
let dashboardAnalyticsCache = null;
let dashboardAnalyticsInFlight = null;
export async function getDashboardCounts() {
    const now = Date.now();
    if (dashboardAnalyticsCache && dashboardAnalyticsCache.expiresAt > now) {
        return dashboardAnalyticsCache.data;
    }
    if (dashboardAnalyticsInFlight)
        return dashboardAnalyticsInFlight;
    dashboardAnalyticsInFlight = buildDashboardCounts()
        .then((data) => {
        dashboardAnalyticsCache = { data, expiresAt: Date.now() + DASHBOARD_CACHE_MS };
        return data;
    })
        .finally(() => {
        dashboardAnalyticsInFlight = null;
    });
    return dashboardAnalyticsInFlight;
}
async function buildDashboardCounts() {
    const [summaryResult, trendResult, statusResult, profileResult, monthlyTrendResult, topCustomersResult, growthControlResult] = await Promise.all([
        pool.query("select (select count(*) from zigo.users where deleted_at is null) as users, (select count(*) from zigo.customers) as customers, (select count(*) from zigo.assistants) as assistants, (select count(*) from zigo.payments) as payments, count(*) as \"serviceRequests\", count(*) filter (where lower(coalesce(sr.status_code, '')) in ('completed', 'complete', 'closed', 'success')) as \"completedBookings\", count(*) filter (where lower(coalesce(sr.status_code, '')) in ('working', 'in_progress', 'in-progress')) as \"workingBookings\", count(*) filter (where lower(coalesce(sr.status_code, '')) in ('cancelled', 'canceled', 'rejected', 'failed')) as \"cancelledBookings\", coalesce(sum(coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0)), 0)::bigint as \"sellingAmountPaise\", coalesce(sum(sr.discount_paise), 0)::bigint as \"discountAmountPaise\", coalesce(sum(case when sr.actual_task_started_at is not null and sr.completed_at is not null then greatest(0, extract(epoch from (sr.completed_at - sr.actual_task_started_at)) / 60) else 0 end), 0)::bigint as \"workedMinutes\", coalesce(sum(greatest(coalesce(sr.duration_minutes, 0), 0)), 0)::bigint as \"bookedMinutes\", coalesce(sum(case when lower(coalesce(sr.status_code, '')) in ('cancelled', 'canceled', 'rejected', 'failed') then coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0) else 0 end), 0)::bigint as \"potentialLossPaise\" from zigo.service_requests sr"),
        pool.query("select to_char(days.day::date, 'DD Mon') as label, count(sr.id)::bigint as bookings, coalesce(sum(coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0)), 0)::bigint as \"sellingAmountPaise\", coalesce(sum(sr.discount_paise), 0)::bigint as \"discountAmountPaise\", coalesce(sum(case when lower(coalesce(sr.status_code, '')) in ('cancelled', 'canceled', 'rejected', 'failed') then coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0) else 0 end), 0)::bigint as \"potentialLossPaise\" from generate_series(current_date - interval '6 days', current_date, interval '1 day') as days(day) left join zigo.service_requests sr on sr.created_at >= days.day and sr.created_at < days.day + interval '1 day' group by days.day order by days.day"),
        pool.query("select coalesce(nullif(lower(status_code), ''), 'unknown') as \"statusCode\", count(*)::bigint as count from zigo.service_requests where created_at >= current_date - interval '30 days' group by 1 order by count desc, \"statusCode\" limit 8"),
        pool.query("select (select count(*) from zigo.customers c join zigo.users u on u.id = c.user_id where u.deleted_at is null) as \"totalCustomers\", (select count(*) from zigo.customers c join zigo.users u on u.id = c.user_id where u.deleted_at is null and coalesce(nullif(trim(u.display_name), ''), '') <> '' and (coalesce(nullif(trim(u.phone), ''), '') <> '' or coalesce(nullif(trim(u.email), ''), '') <> '')) as \"completeCustomers\", (select count(*) from zigo.assistants a join zigo.users u on u.id = a.user_id where u.deleted_at is null) as \"totalAssistants\", (select count(*) from zigo.assistants a join zigo.users u on u.id = a.user_id where u.deleted_at is null and coalesce(nullif(trim(u.display_name), ''), '') <> '' and (coalesce(nullif(trim(u.phone), ''), '') <> '' or coalesce(nullif(trim(u.email), ''), '') <> '')) as \"completeAssistants\""),
        pool.query("select to_char(months.month::date, 'Mon YY') as label, count(sr.id)::bigint as bookings, coalesce(sum(coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0)), 0)::bigint as \"sellingAmountPaise\", coalesce(sum(sr.discount_paise), 0)::bigint as \"discountAmountPaise\" from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') as months(month) left join zigo.service_requests sr on sr.created_at >= months.month and sr.created_at < months.month + interval '1 month' group by months.month order by months.month"),
        pool.query("select c.id as \"customerId\", coalesce(nullif(trim(u.display_name), ''), 'Customer') as \"customerName\", coalesce(u.phone, '') as phone, count(sr.id)::bigint as \"bookingCount\", coalesce(sum(coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0)) filter (where sr.is_paid = true), 0)::bigint as \"paidAmountPaise\", coalesce(sum(case when sr.actual_task_started_at is not null and sr.completed_at is not null then greatest(0, extract(epoch from (sr.completed_at - sr.actual_task_started_at)) / 60) else 0 end), 0)::bigint as \"workedMinutes\" from zigo.service_requests sr join zigo.customers c on c.id = sr.customer_id join zigo.users u on u.id = c.user_id where u.deleted_at is null and sr.created_at >= current_date - interval '12 months' group by c.id, u.display_name, u.phone having count(sr.id) > 0 order by \"paidAmountPaise\" desc, \"workedMinutes\" desc limit 5"),
        pool.query("select coalesce(sum(coalesce(nullif(selling_price_paise, 0), nullif(booking_amount_paise, 0), estimated_amount_paise, 0)) filter (where created_at >= date_trunc('month', current_date)), 0)::bigint as \"currentMonthSellingPaise\", coalesce(sum(coalesce(nullif(selling_price_paise, 0), nullif(booking_amount_paise, 0), estimated_amount_paise, 0)) filter (where created_at >= date_trunc('month', current_date) - interval '1 month' and created_at < date_trunc('month', current_date)), 0)::bigint as \"previousMonthSellingPaise\", count(*) filter (where created_at >= date_trunc('month', current_date))::bigint as \"currentMonthBookings\", count(*) filter (where created_at >= date_trunc('month', current_date) - interval '1 month' and created_at < date_trunc('month', current_date))::bigint as \"previousMonthBookings\" from zigo.service_requests")
    ]);
    const topWorkedCustomersResult = await pool.query("select c.id as \"customerId\", coalesce(nullif(trim(u.display_name), ''), 'Customer') as \"customerName\", coalesce(u.phone, '') as phone, count(sr.id)::bigint as \"bookingCount\", coalesce(sum(coalesce(nullif(sr.selling_price_paise, 0), nullif(sr.booking_amount_paise, 0), sr.estimated_amount_paise, 0)) filter (where sr.is_paid = true), 0)::bigint as \"paidAmountPaise\", coalesce(sum(case when sr.actual_task_started_at is not null and sr.completed_at is not null then greatest(0, extract(epoch from (sr.completed_at - sr.actual_task_started_at)) / 60) else 0 end), 0)::bigint as \"workedMinutes\" from zigo.service_requests sr join zigo.customers c on c.id = sr.customer_id join zigo.users u on u.id = c.user_id where u.deleted_at is null and sr.created_at >= current_date - interval '12 months' group by c.id, u.display_name, u.phone having count(sr.id) > 0 order by \"workedMinutes\" desc, \"paidAmountPaise\" desc limit 5");
    const summary = summaryResult.rows[0];
    const profiles = profileResult.rows[0];
    return {
        ...summary,
        dailyTrend: trendResult.rows,
        monthlyTrend: monthlyTrendResult.rows,
        statusBreakdown: statusResult.rows,
        topCustomers: topCustomersResult.rows,
        topWorkingCustomers: topWorkedCustomersResult.rows,
        growthControl: growthControlResult.rows[0],
        profileCompletion: {
            ...profiles,
            totalProfiles: String(Number(profiles.totalCustomers || 0) + Number(profiles.totalAssistants || 0)),
            completeProfiles: String(Number(profiles.completeCustomers || 0) + Number(profiles.completeAssistants || 0))
        }
    };
}
export async function listAdminActions(limit, offset) {
    const result = await pool.query(`
      select
        id,
        actor_user_id as "actorUserId",
        entity_type as "entityType",
        entity_id as "entityId",
        action_type_id as "actionTypeId",
        reason_id as "reasonId",
        notes,
        before_data as "beforeData",
        after_data as "afterData",
        created_at as "createdAt"
      from zigo.admin_actions
      order by created_at desc
      limit $1 offset $2
    `, [limit, offset]);
    return result.rows;
}
export async function getDashboardRangeAnalytics(startDate, endDate) {
    const range = [startDate, endDate];
    const [summary, trend] = await Promise.all([
        pool.query(`select
      count(sr.id)::bigint as "serviceRequests",
      count(distinct sr.customer_id)::bigint as "customers",
      count(distinct ta.assistant_id)::bigint as assistants,
      coalesce(sum(coalesce(nullif(sr.selling_price_paise,0), nullif(sr.booking_amount_paise,0), sr.estimated_amount_paise,0)),0)::bigint as "sellingAmountPaise",
      coalesce(sum(sr.discount_paise),0)::bigint as "discountAmountPaise",
      coalesce(sum(greatest(coalesce(sr.duration_minutes,0),0)),0)::bigint as "bookedMinutes",
      coalesce(sum(case when sr.actual_task_started_at is not null and sr.completed_at is not null then greatest(0,extract(epoch from (sr.completed_at-sr.actual_task_started_at))/60) else 0 end),0)::bigint as "workedMinutes",
      count(sr.id) filter(where lower(coalesce(sr.status_code,'')) in ('completed','complete','closed','success'))::bigint as "completedBookings",
      count(sr.id) filter(where lower(coalesce(sr.status_code,'')) in ('working','in_progress','in-progress'))::bigint as "workingBookings",
      count(sr.id) filter(where lower(coalesce(sr.status_code,'')) in ('cancelled','canceled','rejected','failed'))::bigint as "cancelledBookings",
      coalesce(sum(case when lower(coalesce(sr.status_code,'')) in ('cancelled','canceled','rejected','failed') then coalesce(nullif(sr.selling_price_paise,0),nullif(sr.booking_amount_paise,0),sr.estimated_amount_paise,0) else 0 end),0)::bigint as "potentialLossPaise"
     from zigo.service_requests sr
     left join zigo.task_assignments ta on (ta.service_request_id=sr.id or ta.request_id=sr.id)
     where sr.created_at >= $1::date and sr.created_at < $2::date + interval '1 day'`, range),
        pool.query(`select to_char(days.day::date,'DD Mon') as label,
      count(sr.id)::bigint as bookings,
      count(distinct sr.customer_id)::bigint as customers,
      count(distinct ta.assistant_id)::bigint as assistants,
      coalesce(sum(coalesce(nullif(sr.selling_price_paise,0),nullif(sr.booking_amount_paise,0),sr.estimated_amount_paise,0)),0)::bigint as "sellingAmountPaise"
     from generate_series($1::date,$2::date,interval '1 day') days(day)
     left join zigo.service_requests sr on sr.created_at>=days.day and sr.created_at<days.day+interval '1 day'
     left join zigo.task_assignments ta on (ta.service_request_id=sr.id or ta.request_id=sr.id)
     group by days.day order by days.day`, range)
    ]);
    return { ...summary.rows[0], dailyTrend: trend.rows, monthlyTrend: trend.rows };
}
