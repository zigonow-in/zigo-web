import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
let assistantMasterSchemaReady = null;
function ensureAssistantMasterSchema() {
    if (!assistantMasterSchemaReady) {
        assistantMasterSchemaReady = pool.query(`
    create table if not exists zigo.vehicle_master (
      id uuid primary key default gen_random_uuid(),
      vehicle_name text not null,
      company text,
      vehicle_number text,
      model text,
      fuel_type text not null,
      color text,
      picture_urls jsonb not null default '[]'::jsonb,
      owner_type text not null default 'Self',
      rental_company_name text,
      rental_company_address text,
      rental_company_number text,
      rent_slab text,
      rent_charges numeric(12,2),
      is_active boolean not null default true,
      is_deleted boolean not null default false,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz
    );

    create table if not exists zigo.assistant_vehicle_assignments (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      vehicle_master_id uuid not null references zigo.vehicle_master(id),
      is_active boolean not null default true,
      assigned_by uuid references zigo.users(id),
      assigned_at timestamptz not null default now(),
      removed_by uuid references zigo.users(id),
      removed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create unique index if not exists uq_assistant_vehicle_assignment_active_assistant
      on zigo.assistant_vehicle_assignments(assistant_id)
      where is_active = true;

    create unique index if not exists uq_assistant_vehicle_assignment_active_vehicle
      on zigo.assistant_vehicle_assignments(vehicle_master_id)
      where is_active = true;

    create table if not exists zigo.assistant_vehicle_damage_reports (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      vehicle_master_id uuid references zigo.vehicle_master(id),
      vehicle_assignment_id uuid references zigo.assistant_vehicle_assignments(id),
      reason text not null,
      proof_picture_urls jsonb not null default '[]'::jsonb,
      expense numeric(12,2),
      paid_by text not null,
      payment_proof_url text,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now()
    );

    create index if not exists idx_assistant_damage_reports_assistant
      on zigo.assistant_vehicle_damage_reports(assistant_id, created_at desc);

    create table if not exists zigo.assistant_cluster_map (
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      cluster_id uuid not null references zigo.clusters(id),
      is_primary boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists zigo.assistant_master_logs (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      action text not null,
      entity_type text not null,
      entity_id text,
      details jsonb not null default '{}'::jsonb,
      actor_user_id uuid references zigo.users(id),
      created_at timestamptz not null default now()
    );

    create index if not exists idx_assistant_master_logs_assistant
      on zigo.assistant_master_logs(assistant_id, created_at desc);

    create table if not exists zigo.assistant_availability (
      assistant_id uuid primary key references zigo.assistants(id) on delete cascade,
      status_code text not null default 'offline',
      latitude numeric(10,7),
      longitude numeric(10,7),
      online_started_at timestamptz,
      today_online_seconds integer not null default 0,
      today_online_date date not null default current_date,
      updated_at timestamptz not null default now()
    );

    alter table zigo.assistant_availability add column if not exists status_code text not null default 'offline';
    alter table zigo.assistant_availability add column if not exists latitude numeric(10,7);
    alter table zigo.assistant_availability add column if not exists longitude numeric(10,7);
    alter table zigo.assistant_availability add column if not exists online_started_at timestamptz;
    alter table zigo.assistant_availability add column if not exists today_online_seconds integer not null default 0;
    alter table zigo.assistant_availability add column if not exists today_online_date date not null default current_date;
    alter table zigo.assistant_availability add column if not exists updated_at timestamptz not null default now();
    create unique index if not exists uq_assistant_availability_assistant on zigo.assistant_availability(assistant_id);
  `)
            .then(() => undefined)
            .catch((error) => {
            assistantMasterSchemaReady = null;
            throw error;
        });
    }
    return assistantMasterSchemaReady;
}
export async function logAssistantMasterEvent(input, client = pool) {
    await ensureAssistantMasterSchema();
    await client.query(`
      insert into zigo.assistant_master_logs
        (assistant_id, action, entity_type, entity_id, details, actor_user_id)
      values ($1, $2, $3, $4, $5::jsonb, $6)
    `, [
        input.assistantId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.details ?? {}),
        input.actorUserId ?? null
    ]);
}
export async function listAssistantMasterLogs(assistantId) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(assistantId);
    const result = await pool.query(`
      select
        l.id,
        l.action,
        l.entity_type as "entityType",
        l.entity_id as "entityId",
        l.details,
        l.created_at as "createdAt",
        u.display_name as "actorName",
        u.email::text as "actorEmail",
        u.phone as "actorPhone"
      from zigo.assistant_master_logs l
      left join zigo.users u on u.id = l.actor_user_id
      where l.assistant_id = $1
      order by l.created_at desc
      limit 200
    `, [assistantId]);
    return result.rows;
}
function toAssignmentWriteError(error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return new HttpError(409, "This assistant or vehicle already has an active vehicle assignment. Remove the current assignment before assigning another vehicle.");
    }
    return error;
}
async function assertAssistantExists(assistantId) {
    const result = await pool.query("select id from zigo.assistants where id = $1 limit 1", [assistantId]);
    if (!result.rows[0])
        throw new HttpError(404, "Assistant not found.");
}
async function assertAssistantCanGoOnline(assistantId) {
    const result = await pool.query(`
      select
        coalesce(u.metadata->>'accountStatus', 'inactive') = 'active' as "isActive",
        (
          a.current_cluster_id is not null
          or exists (
            select 1
            from zigo.assistant_cluster_map acm
            where acm.assistant_id = a.id and coalesce(acm.is_active, true) = true
          )
        ) as "hasCluster",
        exists (
          select 1
          from zigo.assistant_vehicle_assignments ava
          join zigo.vehicle_master vm on vm.id = ava.vehicle_master_id
          where ava.assistant_id = a.id
            and ava.is_active = true
            and vm.is_active = true
            and coalesce(vm.is_deleted, false) = false
        ) as "hasVehicle",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('aadhaar_front', 'aadhaar_card_front') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "aadhaarFrontVerified",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('aadhaar_back', 'aadhaar_card_back') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "aadhaarBackVerified",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('pan_front', 'pan_card_front') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "panFrontVerified",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('pan_back', 'pan_card_back') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "panBackVerified",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('driving_license_front', 'driving_licence_front') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "drivingLicenceFrontVerified",
        exists (
          select 1 from zigo.assistant_documents ad
          join zigo.document_types dt on dt.id = ad.document_type_id
          where ad.assistant_id = a.id and dt.code in ('driving_license_back', 'driving_licence_back') and coalesce(ad.metadata->>'verificationStatus', 'verifying') = 'verified'
        ) as "drivingLicenceBackVerified"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      where a.id = $1 and u.deleted_at is null
      limit 1
    `, [assistantId]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(404, "Assistant not found.");
    const missing = [];
    if (!row.isActive)
        missing.push("assistant is deactive");
    if (!row.hasCluster)
        missing.push("cluster is not assigned");
    if (!row.hasVehicle)
        missing.push("vehicle is not allotted");
    if (!row.aadhaarFrontVerified || !row.aadhaarBackVerified || !row.panFrontVerified || !row.panBackVerified || !row.drivingLicenceFrontVerified || !row.drivingLicenceBackVerified) {
        missing.push("all required documents are not verified");
    }
    if (missing.length)
        throw new HttpError(400, `Assistant cannot go online until ${missing.join(", ")}.`);
}
async function assertAssistantCanLogIn(assistantId) {
    const result = await pool.query(`
      select coalesce(u.metadata->>'accountStatus', 'inactive') = 'active' as "isActive"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      where a.id = $1 and u.deleted_at is null
      limit 1
    `, [assistantId]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(404, "Assistant not found.");
    if (!row.isActive)
        throw new HttpError(400, "Deactive assistant cannot be marked Logged-In.");
}
function formatOnlineDuration(seconds) {
    const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
    const minutes = Math.floor(safeSeconds / 60);
    if (minutes < 60)
        return `${minutes} mins`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} Hrs`;
}
export async function listAssistantMasters() {
    await ensureAssistantMasterSchema();
    const result = await pool.query(`
    select
      a.id,
      a.assistant_code as "assistantCode",
      a.user_id as "userId",
      u.display_name as "displayName",
      u.phone,
      u.email::text as email,
      u.last_login_at as "lastLoginAt",
      case
        when coalesce(u.metadata, '{}'::jsonb) ? 'isLoggedIn' then lower(coalesce(u.metadata->>'isLoggedIn', '')) in ('true', '1', 'yes')
        else u.last_login_at is not null
      end as "isLoggedIn",
      coalesce(a.metadata->>'workingType', 'full_time') as "workingType",
      a.metadata->>'workingTimeSlot' as "workingTimeSlot",
      a.metadata->'workingSchedule' as "workingSchedule",
      coalesce(a.metadata->>'payType', 'per_task') as "payType",
      coalesce(a.metadata->>'verificationStatus', u.metadata->>'accountStatus', 'verifying') as "status",
      case
        when coalesce(av.status_code, 'offline') = 'working'
          and coalesce(nullif(task_stats.stats->>'working', '')::int, 0) = 0
        then 'available'
        else coalesce(av.status_code, 'offline')
      end as "availabilityStatus",
      av.updated_at as "availabilityUpdatedAt",
      av.online_started_at as "onlineStartedAt",
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
      ) as "todayOnlineSeconds",
      coalesce(u.metadata->>'accountStatus', 'inactive') = 'active' as "isActive",
      coalesce(u.metadata->>'otpVerificationStatus', 'not_required') as "otpVerificationStatus",
      u.metadata->'otpChannelStatus' as "otpChannelStatus",
      a.current_cluster_id as "currentClusterId",
      c.name as "currentClusterName",
      c.city_id as "cityId",
      city.name as "cityName",
      c.zone_id as "zoneId",
      zone.name as "zoneName",
      coalesce(profile_doc.preview_url, u.metadata->>'profilePictureUrl') as "profilePictureUrl",
      coalesce(cluster_docs.clusters, '[]'::jsonb) as clusters,
      vehicle_assignment.id as "vehicleAssignmentId",
      vehicle_assignment.vehicle_master_id as "vehicleMasterId",
      vehicle_assignment.vehicle_name as "vehicleName",
      vehicle_assignment.vehicle_number as "vehicleNumber",
      vehicle_assignment.company as "vehicleCompany",
      vehicle_assignment.model as "vehicleModel",
      vehicle_assignment.color as "vehicleColor",
      vehicle_assignment.owner_type as "vehicleOwnerType",
      vehicle_assignment.picture_urls as "vehiclePictureUrls",
      coalesce(doc_docs.documents, '[]'::jsonb) as documents,
      coalesce(damage_docs.damage_reports, '[]'::jsonb) as "damageReports",
      coalesce(task_stats.stats, jsonb_build_object(
        'totalTask', 0,
        'success', 0,
        'working', 0,
        'rejected', 0,
        'cancelled', 0,
        'totalValuePaise', 0,
        'successValuePaise', 0,
        'workingValuePaise', 0,
        'rejectedValuePaise', 0,
        'cancelledValuePaise', 0
      )) as "taskStats",
      coalesce(today_task_stats.stats, jsonb_build_object(
        'assigned', 0,
        'pending', 0,
        'completed', 0,
        'cancelled', 0
      )) as "todayTaskStats",
      active_windows.next_available_at as "nextAvailableAt",
      coalesce(active_windows.bookings, '[]'::jsonb) as "activeBookingWindows",
      a.created_at as "createdAt"
    from zigo.assistants a
    join zigo.users u on u.id = a.user_id
    left join zigo.assistant_availability av on av.assistant_id = a.id
    left join zigo.clusters c on c.id = a.current_cluster_id
    left join zigo.cities city on city.id = c.city_id
    left join zigo.zones zone on zone.id = c.zone_id
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
      select jsonb_agg(jsonb_build_object(
        'clusterId', acm.cluster_id,
        'clusterName', cl.name,
        'isPrimary', acm.is_primary,
        'isActive', acm.is_active
      ) order by acm.is_primary desc, cl.name) as clusters
      from zigo.assistant_cluster_map acm
      join zigo.clusters cl on cl.id = acm.cluster_id
      where acm.assistant_id = a.id and coalesce(acm.is_active, true) = true
    ) cluster_docs on true
    left join lateral (
      select
        ava.id,
        ava.vehicle_master_id,
        vm.vehicle_name,
        vm.vehicle_number,
        vm.company,
        vm.model,
        vm.color,
        vm.owner_type,
        vm.picture_urls
      from zigo.assistant_vehicle_assignments ava
      join zigo.vehicle_master vm on vm.id = ava.vehicle_master_id
      where ava.assistant_id = a.id
        and ava.is_active = true
        and coalesce(vm.is_deleted, false) = false
      order by ava.assigned_at desc
      limit 1
    ) vehicle_assignment on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', ad.id,
        'documentTypeId', dt.id,
        'documentTypeCode', dt.code,
        'documentTypeName', dt.name,
        'originalName', f.original_name,
        'mimeType', f.mime_type,
        'previewUrl', f.object_key,
        'verificationStatus', coalesce(ad.metadata->>'verificationStatus', 'verifying')
      ) order by dt.code) as documents
      from zigo.assistant_documents ad
      left join zigo.document_types dt on dt.id = ad.document_type_id
      left join zigo.files f on f.id = ad.file_id
      where ad.assistant_id = a.id
    ) doc_docs on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', adr.id,
        'vehicleMasterId', adr.vehicle_master_id,
        'vehicleName', dvm.vehicle_name,
        'reason', adr.reason,
        'proofPictureUrls', adr.proof_picture_urls,
        'expense', adr.expense,
        'paidBy', adr.paid_by,
        'paymentProofUrl', adr.payment_proof_url,
        'createdAt', adr.created_at
      ) order by adr.created_at desc) as damage_reports
      from zigo.assistant_vehicle_damage_reports adr
      left join zigo.vehicle_master dvm on dvm.id = adr.vehicle_master_id
      where adr.assistant_id = a.id
    ) damage_docs on true
    left join lateral (
      select jsonb_build_object(
        'totalTask', count(*)::int,
        'success', count(*) filter (where status_code = 'completed')::int,
        'working', count(*) filter (where status_code in ('in_progress', 'approval_pending') or assignment_status in ('in_progress', 'approval_pending'))::int,
        'rejected', count(*) filter (where status_code = 'failed' or assignment_status in ('rejected', 'declined', 'not_accepted'))::int,
        'cancelled', count(*) filter (where status_code = 'cancelled')::int,
        'totalValuePaise', coalesce(sum(estimated_amount_paise), 0)::bigint,
        'successValuePaise', coalesce(sum(estimated_amount_paise) filter (where status_code = 'completed'), 0)::bigint,
        'workingValuePaise', coalesce(sum(estimated_amount_paise) filter (where status_code in ('in_progress', 'approval_pending') or assignment_status in ('in_progress', 'approval_pending')), 0)::bigint,
        'rejectedValuePaise', coalesce(sum(estimated_amount_paise) filter (where status_code = 'failed' or assignment_status in ('rejected', 'declined', 'not_accepted')), 0)::bigint,
        'cancelledValuePaise', coalesce(sum(estimated_amount_paise) filter (where status_code = 'cancelled'), 0)::bigint
      ) as stats
      from (
        select distinct on (sr.id)
          sr.id,
          sr.status_code,
          coalesce(sr.estimated_amount_paise, 0) as estimated_amount_paise,
          ta.status_code as assignment_status
        from zigo.task_assignments ta
        join zigo.service_requests sr on sr.id = ta.service_request_id or sr.id = ta.request_id
        where ta.assistant_id = a.id
          and ta.status_code not in ('released', 'reassigned')
        order by sr.id, ta.offered_at desc nulls last, ta.assigned_at desc nulls last
      ) assistant_tasks
    ) task_stats on true
    left join lateral (
      select jsonb_build_object(
        'assigned', count(*)::int,
        'pending', count(*) filter (
          where status_code not in ('completed', 'success', 'cancelled', 'canceled', 'failed', 'rejected')
            and coalesce(assignment_status, '') not in ('completed', 'success', 'cancelled', 'canceled', 'rejected', 'declined', 'not_accepted')
            and (
              status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted')
              or assignment_status in ('reserved', 'offered', 'assigned', 'accepted')
            )
        )::int,
        'completed', count(*) filter (
          where status_code in ('completed', 'success')
             or assignment_status in ('completed', 'success')
        )::int,
        'cancelled', count(*) filter (
          where status_code in ('cancelled', 'canceled')
             or assignment_status in ('cancelled', 'canceled')
        )::int
      ) as stats
      from (
        select distinct on (sr.id)
          sr.id,
          sr.status_code,
          ta.status_code as assignment_status,
          coalesce(ta.assigned_at, ta.offered_at, sr.created_at) as assigned_at
        from zigo.task_assignments ta
        join zigo.service_requests sr on sr.id = ta.service_request_id or sr.id = ta.request_id
        where ta.assistant_id = a.id
          and ta.status_code not in ('released', 'reassigned')
        order by sr.id, ta.offered_at desc nulls last, ta.assigned_at desc nulls last
      ) today_tasks
      where assigned_at::date = current_date
    ) today_task_stats on true
    left join lateral (
      select
        max(coalesce(
          sr.booking_available_at,
          case
            when nullif(sr.metadata->>'expectedFreeAt', '') ~ '^\\d{4}-\\d{2}-\\d{2}[T ][0-9]{2}:[0-9]{2}'
            then nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz
            else null
          end,
          sr.booking_end_at,
          sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
        )) as next_available_at,
        jsonb_agg(jsonb_build_object(
          'serviceRequestId', sr.id,
          'requestNumber', sr.request_number,
          'statusCode', sr.status_code,
          'assignmentStatus', ta.status_code,
          'bookingType', coalesce(sr.metadata->>'bookingType', 'instant'),
          'scheduledDate', sr.metadata->>'scheduledDate',
          'scheduledTime', sr.metadata->>'scheduledTime',
          'startAt', case
            when sr.metadata->>'bookingType' = 'schedule' and nullif(sr.metadata->>'scheduledDate', '') is not null and nullif(sr.metadata->>'scheduledTime', '') is not null
            then ((sr.metadata->>'scheduledDate') || 'T' || (sr.metadata->>'scheduledTime') || ':00')
            else sr.created_at::text
          end,
          'expectedFreeAt', coalesce(
            sr.booking_available_at,
            case
              when nullif(sr.metadata->>'expectedFreeAt', '') ~ '^\\d{4}-\\d{2}-\\d{2}[T ][0-9]{2}:[0-9]{2}'
              then nullif(sr.metadata->>'expectedFreeAt', '')::timestamptz
              else null
            end,
            sr.booking_end_at,
            sr.created_at + (coalesce(sr.duration_minutes, 30) || ' minutes')::interval
          )::text,
          'durationMinutes', coalesce(sr.duration_minutes, 30)
        ) order by sr.created_at desc) as bookings
      from zigo.task_assignments ta
      join zigo.service_requests sr on sr.id = ta.service_request_id or sr.id = ta.request_id
      where ta.assistant_id = a.id
        and ta.status_code in ('reserved', 'offered', 'assigned', 'accepted', 'in_progress', 'approval_pending')
        and sr.status_code in ('payment_pending', 'paid', 'queued', 'assigned', 'accepted', 'in_progress', 'approval_pending')
    ) active_windows on true
    where u.deleted_at is null
    order by a.created_at desc
  `);
    return result.rows;
}
export async function getAssistantRealtimeSnapshot(assistantId) {
    const assistants = await listAssistantMasters();
    const assistant = assistants.find((item) => item.id === assistantId);
    if (!assistant)
        return null;
    return {
        ...assistant,
        documents: undefined,
        damageReports: undefined
    };
}
export async function updateAssistantAvailability(input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(input.assistantId);
    if (input.isOnline)
        await assertAssistantCanGoOnline(input.assistantId);
    const statusCode = input.isOnline ? "available" : "offline";
    const previous = await pool.query(`
      select
        coalesce(status_code, 'offline') as "statusCode",
        online_started_at as "onlineStartedAt",
        updated_at as "updatedAt",
        case
          when today_online_date = current_date then coalesce(today_online_seconds, 0)
          else 0
        end
        +
        case
          when coalesce(status_code, 'offline') in ('available', 'online', 'active', 'working')
            and coalesce(online_started_at, updated_at) is not null
            and today_online_date = current_date
          then greatest(0, extract(epoch from (now() - coalesce(online_started_at, updated_at)))::int)
          else 0
        end as "previousTodayOnlineSeconds"
      from zigo.assistant_availability
      where assistant_id = $1
      limit 1
    `, [input.assistantId]);
    const previousStatus = previous.rows[0]?.statusCode || "offline";
    const previousTodayOnlineSeconds = Number(previous.rows[0]?.previousTodayOnlineSeconds || 0);
    const result = await pool.query(input.isOnline
        ? `
        insert into zigo.assistant_availability
          (assistant_id, status_code, online_started_at, today_online_seconds, today_online_date, updated_at)
        values ($1, 'available', now(), 0, current_date, now())
        on conflict (assistant_id)
        do update set
          status_code = 'available',
          online_started_at = case
            when zigo.assistant_availability.today_online_date = current_date
              and zigo.assistant_availability.status_code in ('available', 'online', 'active', 'working')
              and zigo.assistant_availability.online_started_at is not null
            then zigo.assistant_availability.online_started_at
            else now()
          end,
          today_online_seconds = case
            when zigo.assistant_availability.today_online_date = current_date then zigo.assistant_availability.today_online_seconds
            else 0
          end,
          today_online_date = current_date,
          updated_at = now()
        returning assistant_id as "assistantId",
          status_code as "availabilityStatus",
          online_started_at as "onlineStartedAt",
          updated_at as "availabilityUpdatedAt",
          (
            case when today_online_date = current_date then coalesce(today_online_seconds, 0) else 0 end
            + case when online_started_at is not null then greatest(0, extract(epoch from (now() - online_started_at))::int) else 0 end
          ) as "todayOnlineSeconds"
      `
        : `
        insert into zigo.assistant_availability
          (assistant_id, status_code, online_started_at, today_online_seconds, today_online_date, updated_at)
        values ($1, 'offline', null, 0, current_date, now())
        on conflict (assistant_id)
        do update set
          status_code = 'offline',
          today_online_seconds = case
            when zigo.assistant_availability.today_online_date = current_date
              and zigo.assistant_availability.status_code in ('available', 'online', 'active', 'working')
              and coalesce(zigo.assistant_availability.online_started_at, zigo.assistant_availability.updated_at) is not null
            then zigo.assistant_availability.today_online_seconds + greatest(0, extract(epoch from (now() - coalesce(zigo.assistant_availability.online_started_at, zigo.assistant_availability.updated_at)))::int)
            when zigo.assistant_availability.today_online_date = current_date
            then zigo.assistant_availability.today_online_seconds
            else 0
          end,
          today_online_date = current_date,
          online_started_at = null,
          updated_at = now()
        returning assistant_id as "assistantId",
          status_code as "availabilityStatus",
          online_started_at as "onlineStartedAt",
          updated_at as "availabilityUpdatedAt",
          case when today_online_date = current_date then coalesce(today_online_seconds, 0) else 0 end as "todayOnlineSeconds"
      `, [input.assistantId]);
    if (input.isOnline) {
        await pool.query(`
        update zigo.users u
        set last_login_at = coalesce(u.last_login_at, now()),
            metadata = jsonb_set(coalesce(u.metadata, '{}'::jsonb), '{isLoggedIn}', 'true'::jsonb, true),
            updated_at = now()
        from zigo.assistants a
        where a.user_id = u.id and a.id = $1
      `, [input.assistantId]);
    }
    await logAssistantMasterEvent({
        assistantId: input.assistantId,
        action: input.isOnline ? "assistant_online" : "assistant_offline",
        entityType: "assistant_availability",
        details: {
            previousStatus,
            newStatus: statusCode,
            previousTodayOnlineSeconds,
            previousTodayOnlineTime: formatOnlineDuration(previousTodayOnlineSeconds),
            todayOnlineSeconds: Number(result.rows[0]?.todayOnlineSeconds || 0),
            todayOnlineTime: formatOnlineDuration(Number(result.rows[0]?.todayOnlineSeconds || 0)),
            startedAt: input.isOnline ? result.rows[0]?.onlineStartedAt || null : null,
            stoppedAt: input.isOnline ? null : result.rows[0]?.availabilityUpdatedAt || null
        },
        actorUserId: input.actorUserId
    });
    return result.rows[0] ?? { assistantId: input.assistantId, availabilityStatus: statusCode, todayOnlineSeconds: 0 };
}
export async function updateAssistantLoginStatus(input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(input.assistantId);
    if (input.isLoggedIn)
        await assertAssistantCanLogIn(input.assistantId);
    const result = await pool.query(`
      update zigo.users u
      set last_login_at = case when $2::boolean then coalesce(u.last_login_at, now()) else u.last_login_at end,
          metadata = jsonb_set(coalesce(u.metadata, '{}'::jsonb), '{isLoggedIn}', to_jsonb($2::boolean), true),
          updated_at = now()
      from zigo.assistants a
      where a.user_id = u.id and a.id = $1
      returning a.id as "assistantId",
        u.last_login_at as "lastLoginAt",
        case
          when coalesce(u.metadata, '{}'::jsonb) ? 'isLoggedIn' then lower(coalesce(u.metadata->>'isLoggedIn', '')) in ('true', '1', 'yes')
          else u.last_login_at is not null
        end as "isLoggedIn"
    `, [input.assistantId, input.isLoggedIn]);
    const availabilityResult = input.isLoggedIn
        ? null
        : await updateAssistantAvailability({
            assistantId: input.assistantId,
            isOnline: false,
            actorUserId: input.actorUserId
        });
    await logAssistantMasterEvent({
        assistantId: input.assistantId,
        action: input.isLoggedIn ? "assistant_logged_in" : "assistant_logged_out",
        entityType: "assistant_login",
        details: {
            isLoggedIn: input.isLoggedIn,
            lastLoginAt: result.rows[0]?.lastLoginAt || null
        },
        actorUserId: input.actorUserId
    });
    return {
        ...(result.rows[0] ?? { assistantId: input.assistantId, isLoggedIn: input.isLoggedIn }),
        ...(availabilityResult ?? {})
    };
}
export async function updateAssistantWork(assistantId, input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(assistantId);
    const result = await pool.query(`
      update zigo.assistants
      set metadata = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(coalesce(metadata, '{}'::jsonb), '{workingType}', to_jsonb($2::text), true),
                '{workingTimeSlot}', to_jsonb(coalesce($3::text, '')), true
              ),
              '{payType}', to_jsonb($4::text), true
            ),
            '{workingSchedule}', $5::jsonb, true
          ),
          updated_at = now()
      where id = $1
      returning id
    `, [assistantId, input.workingType, input.workingTimeSlot ?? null, input.payType, JSON.stringify(input.workingSchedule ?? {})]);
    if (result.rows[0]) {
        await logAssistantMasterEvent({
            assistantId,
            action: "working_pay_updated",
            entityType: "assistant_work",
            details: {
                workingType: input.workingType,
                workingTimeSlot: input.workingTimeSlot ?? null,
                workingSchedule: input.workingSchedule ?? {},
                payType: input.payType
            },
            actorUserId: input.actorUserId
        });
    }
    return result.rows[0] ?? null;
}
export async function assignAssistantCluster(input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(input.assistantId);
    const cluster = await pool.query("select id, name from zigo.clusters where id = $1 and coalesce(is_deleted, false) = false and coalesce(is_booking_enabled, true) = true limit 1", [input.clusterId]);
    if (!cluster.rows[0])
        throw new HttpError(404, "Active cluster not found. Please select an active cluster.");
    const client = await pool.connect();
    try {
        await client.query("begin");
        await client.query("update zigo.assistant_cluster_map set is_primary = false, is_active = false where assistant_id = $1", [
            input.assistantId
        ]);
        const existing = await client.query(`
        update zigo.assistant_cluster_map
        set is_primary = true,
            is_active = true
        where assistant_id = $1 and cluster_id = $2
      `, [input.assistantId, input.clusterId]);
        if ((existing.rowCount ?? 0) === 0) {
            await client.query(`
          insert into zigo.assistant_cluster_map (assistant_id, cluster_id, is_primary, is_active)
          values ($1, $2, true, true)
        `, [input.assistantId, input.clusterId]);
        }
        await client.query("update zigo.assistants set current_cluster_id = $2, updated_at = now() where id = $1", [
            input.assistantId,
            input.clusterId
        ]);
        await logAssistantMasterEvent({
            assistantId: input.assistantId,
            action: "cluster_assigned",
            entityType: "assistant_cluster",
            entityId: input.clusterId,
            details: { clusterName: cluster.rows[0].name },
            actorUserId: input.actorUserId
        }, client);
        await client.query("commit");
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function removeAssistantCluster(assistantId, actorUserId) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(assistantId);
    await pool.query("update zigo.assistant_cluster_map set is_primary = false, is_active = false where assistant_id = $1", [
        assistantId
    ]);
    await pool.query(`
      update zigo.assistants
      set current_cluster_id = null,
          metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{lastClusterRemovedBy}', to_jsonb($2::text), true),
          updated_at = now()
      where id = $1
    `, [assistantId, actorUserId]);
    await logAssistantMasterEvent({
        assistantId,
        action: "cluster_removed",
        entityType: "assistant_cluster",
        details: {},
        actorUserId
    });
}
export async function assignAssistantVehicle(input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(input.assistantId);
    const vehicle = await pool.query("select id, vehicle_name as \"vehicleName\", vehicle_number as \"vehicleNumber\" from zigo.vehicle_master where id = $1 and coalesce(is_deleted, false) = false and is_active = true limit 1", [input.vehicleMasterId]);
    if (!vehicle.rows[0])
        throw new HttpError(404, "Active vehicle not found. Please select an active vehicle from Vehicle Master.");
    const client = await pool.connect();
    try {
        await client.query("begin");
        await client.query(`
        update zigo.assistant_vehicle_assignments
        set is_active = false,
            removed_by = $2,
            removed_at = now(),
            updated_at = now()
        where assistant_id = $1 and is_active = true
      `, [input.assistantId, input.actorUserId]);
        await client.query(`
        update zigo.assistant_vehicle_assignments
        set is_active = false,
            removed_by = $2,
            removed_at = now(),
            updated_at = now()
        where vehicle_master_id = $1 and is_active = true
      `, [input.vehicleMasterId, input.actorUserId]);
        await client.query(`
        insert into zigo.assistant_vehicle_assignments
          (assistant_id, vehicle_master_id, assigned_by)
        values ($1, $2, $3)
      `, [input.assistantId, input.vehicleMasterId, input.actorUserId]);
        await logAssistantMasterEvent({
            assistantId: input.assistantId,
            action: "vehicle_assigned",
            entityType: "assistant_vehicle",
            entityId: input.vehicleMasterId,
            details: {
                vehicleName: vehicle.rows[0].vehicleName,
                vehicleNumber: vehicle.rows[0].vehicleNumber
            },
            actorUserId: input.actorUserId
        }, client);
        await client.query("commit");
    }
    catch (error) {
        await client.query("rollback");
        throw toAssignmentWriteError(error);
    }
    finally {
        client.release();
    }
}
export async function removeAssistantVehicle(assistantId, actorUserId) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(assistantId);
    await pool.query(`
      update zigo.assistant_vehicle_assignments
      set is_active = false,
          removed_by = $2,
          removed_at = now(),
          updated_at = now()
      where assistant_id = $1 and is_active = true
    `, [assistantId, actorUserId]);
    await logAssistantMasterEvent({
        assistantId,
        action: "vehicle_removed",
        entityType: "assistant_vehicle",
        details: {},
        actorUserId
    });
}
export async function createVehicleDamageReport(input) {
    await ensureAssistantMasterSchema();
    await assertAssistantExists(input.assistantId);
    const activeAssignment = await pool.query(`
      select id, vehicle_master_id as "vehicleMasterId"
      from zigo.assistant_vehicle_assignments
      where assistant_id = $1 and is_active = true
      order by assigned_at desc
      limit 1
    `, [input.assistantId]);
    const vehicleMasterId = input.vehicleMasterId ?? activeAssignment.rows[0]?.vehicleMasterId ?? null;
    if (!vehicleMasterId)
        throw new HttpError(400, "Assign a vehicle before adding a damage report, or select a vehicle.");
    const result = await pool.query(`
      insert into zigo.assistant_vehicle_damage_reports
        (assistant_id, vehicle_master_id, vehicle_assignment_id, reason, proof_picture_urls, expense, paid_by, payment_proof_url, created_by)
      values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
      returning id
    `, [
        input.assistantId,
        vehicleMasterId,
        activeAssignment.rows[0]?.id ?? null,
        input.reason.trim(),
        JSON.stringify(input.proofPictureUrls ?? []),
        input.expense ?? null,
        input.paidBy,
        input.paymentProofUrl ?? null,
        input.actorUserId
    ]);
    await logAssistantMasterEvent({
        assistantId: input.assistantId,
        action: "damage_report_added",
        entityType: "vehicle_damage",
        entityId: result.rows[0].id,
        details: {
            vehicleMasterId,
            reason: input.reason,
            expense: input.expense ?? null,
            paidBy: input.paidBy,
            proofPictureCount: input.proofPictureUrls?.length ?? 0,
            hasPaymentProof: Boolean(input.paymentProofUrl)
        },
        actorUserId: input.actorUserId
    });
    return result.rows[0];
}
