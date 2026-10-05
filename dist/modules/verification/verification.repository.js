import { pool } from "../../db/pool.js";
import bcrypt from "bcryptjs";
import { HttpError } from "../../http/errors.js";
import { getMediaPathValue, MEDIA_PATH_SETTING_KEYS } from "../settings/settings.repository.js";
import { setUserActiveState } from "../users/users.repository.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";
const addUserAssistantDocumentTypes = [
    { code: "aadhaar_front", name: "Aadhaar Card Front Image", entityType: "assistant", description: "Aadhaar card front side" },
    { code: "aadhaar_back", name: "Aadhaar Card Back Image", entityType: "assistant", description: "Aadhaar card back side" },
    { code: "pan_front", name: "PAN Card Front Image", entityType: "assistant", description: "PAN card front side" },
    { code: "pan_back", name: "PAN Card Back Image", entityType: "assistant", description: "PAN card back side" },
    { code: "profile_picture", name: "Profile Picture", entityType: "assistant", description: "Assistant profile picture" },
    { code: "driving_license_front", name: "Driving Licence Front Image", entityType: "assistant", description: "Driving licence front side" },
    { code: "driving_license_back", name: "Driving Licence Back Image", entityType: "assistant", description: "Driving licence back side" }
];
async function ensureAssistantVerificationSchema(client = pool) {
    await client.query(`
    create table if not exists zigo.assistant_document_verification_events (
      id uuid primary key default gen_random_uuid(),
      assistant_document_id uuid not null references zigo.assistant_documents(id) on delete cascade,
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      document_type_id uuid references zigo.document_types(id),
      old_status text,
      new_status text not null,
      remarks text,
      actor_user_id uuid references zigo.users(id),
      created_at timestamptz not null default now()
    );

    create index if not exists idx_assistant_document_verification_events_document
      on zigo.assistant_document_verification_events(assistant_document_id, created_at desc);

    create index if not exists idx_assistant_document_verification_events_assistant
      on zigo.assistant_document_verification_events(assistant_id, created_at desc);

    alter table zigo.assistant_document_verification_events
      add column if not exists assistant_document_id uuid,
      add column if not exists assistant_id uuid,
      add column if not exists document_type_id uuid,
      add column if not exists old_status text,
      add column if not exists new_status text,
      add column if not exists remarks text,
      add column if not exists actor_user_id uuid,
      add column if not exists created_at timestamptz not null default now();

    alter table zigo.assistant_documents
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists verified_by_user_id uuid,
      add column if not exists verified_at timestamptz,
      add column if not exists updated_at timestamptz not null default now();
  `);
}
async function ensureAssistantDocumentWriteSchema(client = pool) {
    await client.query(`
    alter table zigo.assistant_documents
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists verified_by_user_id uuid,
      add column if not exists verified_at timestamptz,
      add column if not exists updated_at timestamptz not null default now();
  `);
}
async function logAssistantDocumentVerificationEvent(client, input) {
    await client.query("savepoint assistant_document_verification_event");
    try {
        await ensureAssistantVerificationSchema(client);
        await client.query(`
        insert into zigo.assistant_document_verification_events
          (assistant_document_id, assistant_id, document_type_id, old_status, new_status, remarks, actor_user_id)
        values ($1, $2, $3, $4, $5, $6, $7)
      `, [
            input.assistantDocumentId,
            input.assistantId,
            input.documentTypeId,
            input.oldStatus,
            input.newStatus,
            input.remarks ?? null,
            input.actorUserId
        ]);
        await client.query("release savepoint assistant_document_verification_event");
    }
    catch {
        await client.query("rollback to savepoint assistant_document_verification_event");
    }
}
async function ensureAddUserAssistantDocumentTypes(client = pool) {
    await ensureAssistantDocumentTypeForeignKey(client);
    const documentTypeIds = new Map();
    for (const type of addUserAssistantDocumentTypes) {
        const result = await client.query(`
        insert into zigo.document_types (code, name, entity_type, description, is_active)
        values ($1, $2, $3, $4, true)
        on conflict (code) do update
          set name = excluded.name,
              entity_type = excluded.entity_type,
              description = excluded.description,
              is_active = true,
              updated_at = now()
        returning id
      `, [type.code, type.name, type.entityType, type.description]);
        documentTypeIds.set(type.code, result.rows[0].id);
    }
    const role = await client.query("select id from zigo.roles where code = 'assistant' limit 1");
    if (!role.rows[0])
        return;
    for (const documentTypeId of documentTypeIds.values()) {
        await client.query(`
        insert into zigo.role_verification_requirements (role_id, document_type_id, is_required)
        values ($1, $2, true)
        on conflict (role_id, document_type_id) do update
          set is_required = true
      `, [role.rows[0].id, documentTypeId]);
    }
}
async function ensureAssistantDocumentTypeForeignKey(client = pool) {
    const constraint = await client.query(`
      select pg_get_constraintdef(c.oid) as def
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'zigo'
        and t.relname = 'assistant_documents'
        and c.conname = 'assistant_documents_document_type_id_fkey'
      limit 1
    `);
    if (!constraint.rows[0]?.def?.includes("zigo.lookup_values"))
        return;
    const incompatible = await client.query(`
      select count(*)::text as total
      from zigo.assistant_documents ad
      left join zigo.document_types dt on dt.id = ad.document_type_id
      where ad.document_type_id is not null and dt.id is null
    `);
    if (Number(incompatible.rows[0]?.total ?? 0) > 0) {
        throw new HttpError(500, "Assistant document schema has legacy document IDs. Please migrate assistant document types before uploading new assistant documents.");
    }
    await client.query(`
    alter table zigo.assistant_documents
      drop constraint assistant_documents_document_type_id_fkey,
      add constraint assistant_documents_document_type_id_fkey
        foreign key (document_type_id) references zigo.document_types(id)
  `);
}
export async function listDocumentTypes() {
    await ensureAddUserAssistantDocumentTypes();
    const result = await pool.query(`
    select id, code, name, entity_type as "entityType", description, is_active as "isActive"
    from zigo.document_types
    order by entity_type, code
  `);
    return result.rows;
}
export async function listRoleVerificationRequirements() {
    const result = await pool.query(`
    select
      r.id as "roleId",
      r.code as "roleCode",
      r.name as "roleName",
      dt.id as "documentTypeId",
      dt.code as "documentTypeCode",
      dt.name as "documentTypeName",
      dt.entity_type as "entityType",
      rvr.is_required as "isRequired"
    from zigo.role_verification_requirements rvr
    join zigo.roles r on r.id = rvr.role_id
    join zigo.document_types dt on dt.id = rvr.document_type_id
    order by r.code, dt.entity_type, dt.code
  `);
    return result.rows;
}
export async function listAssistantVehicles() {
    const result = await pool.query(`
    select
      av.id,
      av.assistant_id as "assistantId",
      a.assistant_code as "assistantCode",
      u.display_name as "assistantName",
      av.vehicle_type as "vehicleType",
      av.registration_number as "registrationNumber",
      av.make,
      av.model,
      av.color,
      av.verification_status as "verificationStatus",
      av.created_at as "createdAt"
    from zigo.assistant_vehicles av
    join zigo.assistants a on a.id = av.assistant_id
    join zigo.users u on u.id = a.user_id
    order by av.created_at desc
  `);
    return result.rows;
}
export async function listAssistantVerifications() {
    const result = await pool.query(`
    select
      a.id,
      a.assistant_code as "assistantCode",
      a.user_id as "userId",
      u.display_name as "displayName",
      u.email::text as email,
      u.phone,
      a.current_cluster_id as "currentClusterId",
      c.name as "currentClusterName",
      coalesce(a.metadata->>'verificationStatus', 'processing') as "verificationStatus",
      a.metadata->>'verificationReason' as "verificationReason",
      a.created_at as "createdAt"
    from zigo.assistants a
    join zigo.users u on u.id = a.user_id
    left join zigo.clusters c on c.id = a.current_cluster_id
    order by a.created_at desc
  `);
    return result.rows;
}
export async function createAssistantForVerification(input) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await pool.connect();
    try {
        await client.query("begin");
        const user = await client.query(`
        insert into zigo.users (email, phone, password_hash, display_name, metadata)
        values ($1, $2, $3, $4, '{"accountStatus": "inactive", "app": "assistant"}'::jsonb)
        returning id
      `, [input.email ?? null, input.phone ?? null, passwordHash, input.displayName]);
        const assistant = await client.query(`
        insert into zigo.assistants (user_id, assistant_code, metadata)
        values ($1, $2, '{"verificationStatus": "processing"}'::jsonb)
        returning id
      `, [user.rows[0].id, input.assistantCode]);
        const role = await client.query("select id from zigo.roles where code = 'assistant'");
        if (role.rows[0]) {
            await client.query(`
          insert into zigo.user_roles (user_id, role_id)
          values ($1, $2)
          on conflict do nothing
        `, [user.rows[0].id, role.rows[0].id]);
        }
        await client.query("commit");
        return { userId: user.rows[0].id, assistantId: assistant.rows[0].id };
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function updateAssistantForVerification(assistantId, input) {
    const result = await pool.query(`
      update zigo.assistants a
      set assistant_code = $2,
          updated_at = now()
      from zigo.users u
      where a.id = $1
        and u.id = a.user_id
      returning u.id as "userId"
    `, [assistantId, input.assistantCode]);
    if (!result.rows[0])
        return null;
    await pool.query(`
      update zigo.users
      set display_name = $2,
          email = $3,
          phone = $4,
          metadata = case
            when $5::boolean is null then metadata
            else jsonb_set(coalesce(metadata, '{}'::jsonb), '{accountStatus}', to_jsonb(case when $5::boolean then 'active' else 'inactive' end::text), true)
          end,
          updated_at = now()
      where id = $1
    `, [result.rows[0].userId, input.displayName, input.email ?? null, input.phone ?? null, input.isActive ?? null]);
    if (typeof input.isActive === "boolean") {
        await setUserActiveState(result.rows[0].userId, input.isActive, input.actorUserId);
    }
    return { assistantId, userId: result.rows[0].userId };
}
export async function deleteAssistantForVerification(assistantId, actorUserId) {
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
      `, [assistantId, actorUserId]);
        const result = await client.query(`
        update zigo.users u
        set deleted_at = now(),
            deleted_by = $2,
            metadata = jsonb_set(coalesce(u.metadata, '{}'::jsonb), '{accountStatus}', '"inactive"'::jsonb, true),
            updated_at = now()
        from zigo.assistants a
        where a.id = $1 and u.id = a.user_id and u.deleted_at is null
        returning a.id, u.id as "userId"
      `, [assistantId, actorUserId]);
        await client.query("commit");
        if (result.rows[0]?.userId)
            await emitBookingRealtimeEvent({ type: 'user.session.revoked', assistantId, payload: { userId: result.rows[0].userId }, message: 'Account access ended.' }).catch(error => console.warn('Account revocation notification failed', error));
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
export async function listAssistantDocuments(assistantId) {
    const result = await pool.query(`
      select
        ad.id,
        ad.assistant_id as "assistantId",
        dt.id as "documentTypeId",
        dt.code as "documentTypeCode",
        dt.name as "documentTypeName",
        f.original_name as "originalName",
        f.mime_type as "mimeType",
        f.object_key as "previewUrl",
        coalesce(ad.metadata->>'verificationStatus', 'verifying') as "verificationStatus",
        ad.metadata->>'remarks' as remarks,
        ad.verified_by_user_id as "verifiedByUserId",
        ad.verified_at as "verifiedAt",
        ad.created_at as "createdAt"
      from zigo.assistant_documents ad
      left join zigo.document_types dt on dt.id = ad.document_type_id
      left join zigo.files f on f.id = ad.file_id
      where ad.assistant_id = $1
      order by dt.code
    `, [assistantId]);
    return result.rows;
}
export async function attachAssistantDocument(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureAssistantDocumentTypeForeignKey(client);
        const documentSavePath = await getMediaPathValue(MEDIA_PATH_SETTING_KEYS.document, client);
        const file = await client.query(`
        insert into zigo.files (storage_provider, bucket, object_key, original_name, mime_type, metadata)
        values ('external_url', $4, $1, $2, $3, jsonb_build_object('preview', true, 'savePath', $4::text))
        returning id
      `, [input.previewUrl, input.originalName, input.mimeType ?? null, documentSavePath]);
        const existing = await client.query(`
        select id
        from zigo.assistant_documents
        where assistant_id = $1 and document_type_id = $2
        limit 1
      `, [input.assistantId, input.documentTypeId]);
        if (existing.rows[0]) {
            await client.query(`
          update zigo.assistant_documents
          set file_id = $2,
              metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', '"verifying"'::jsonb, true),
              updated_at = now()
          where id = $1
        `, [existing.rows[0].id, file.rows[0].id]);
        }
        else {
            await client.query(`
          insert into zigo.assistant_documents (assistant_id, document_type_id, file_id, metadata)
          values ($1, $2, $3, '{"verificationStatus": "verifying"}'::jsonb)
        `, [input.assistantId, input.documentTypeId, file.rows[0].id]);
        }
        await client.query(`
        update zigo.assistants
        set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', '"verifying"'::jsonb, true),
            updated_at = now()
        where id = $1
      `, [input.assistantId]);
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
export async function deleteAssistantDocument(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        const result = await client.query(`
        delete from zigo.assistant_documents
        where id = $1
          and assistant_id = $2
        returning id
      `, [input.documentId, input.assistantId]);
        if (!result.rows[0]) {
            await client.query("rollback");
            return null;
        }
        const status = await recalculateAssistantVerificationStatus(client, input.assistantId);
        await client.query("commit");
        return { id: result.rows[0].id, status };
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function verifyAssistantDocument(input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        await ensureAssistantDocumentWriteSchema(client);
        const existing = await client.query(`
        select
          ad.id,
          ad.document_type_id as "documentTypeId",
          coalesce(ad.metadata->>'verificationStatus', 'verifying') as "oldStatus"
        from zigo.assistant_documents ad
        where ad.id = $1 and ad.assistant_id = $2
        limit 1
      `, [input.documentId, input.assistantId]);
        if (!existing.rows[0]) {
            await client.query("rollback");
            return null;
        }
        const updated = await client.query(`
        update zigo.assistant_documents
        set metadata = jsonb_set(
              jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', to_jsonb($3::text), true),
              '{remarks}', to_jsonb(coalesce($4::text, '')), true
            ),
            verified_by_user_id = $5,
            verified_at = now(),
            updated_at = now()
        where id = $1 and assistant_id = $2
        returning id
      `, [input.documentId, input.assistantId, input.status, input.remarks ?? null, input.actorUserId]);
        await logAssistantDocumentVerificationEvent(client, {
            assistantDocumentId: input.documentId,
            assistantId: input.assistantId,
            documentTypeId: existing.rows[0].documentTypeId,
            oldStatus: existing.rows[0].oldStatus,
            newStatus: input.status,
            remarks: input.remarks ?? null,
            actorUserId: input.actorUserId
        });
        const assistantStatus = await recalculateAssistantVerificationStatus(client, input.assistantId);
        await client.query("commit");
        return { ...updated.rows[0], assistantStatus };
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function updateAssistantVerificationStatus(input) {
    const result = await pool.query(`
      update zigo.assistants
      set metadata = jsonb_set(
            jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', to_jsonb($2::text), true),
            '{verificationReason}', to_jsonb(coalesce($3::text, '')), true
          ),
          updated_at = now()
      where id = $1
      returning id
    `, [input.assistantId, input.status, input.reason ?? null]);
    return result.rows[0] ?? null;
}
async function recalculateAssistantVerificationStatus(client, assistantId) {
    const result = await client.query(`
      with assistant_role as (
        select r.id
        from zigo.roles r
        where r.code = 'assistant'
        limit 1
      ),
      required_docs as (
        select rvr.document_type_id
        from zigo.role_verification_requirements rvr
        join assistant_role ar on ar.id = rvr.role_id
        where rvr.is_required = true
      ),
      submitted as (
        select
          rd.document_type_id,
          ad.id,
          coalesce(ad.metadata->>'verificationStatus', 'verifying') as status
        from required_docs rd
        left join zigo.assistant_documents ad
          on ad.document_type_id = rd.document_type_id
         and ad.assistant_id = $1
      )
      select
        count(*)::text as "requiredCount",
        count(id)::text as "submittedCount",
        count(*) filter (where status = 'verified')::text as "verifiedCount",
        count(*) filter (where status = 'invalid_document')::text as "invalidCount",
        count(*) filter (where status = 'rejected')::text as "rejectedCount"
      from submitted
    `, [assistantId]);
    const row = result.rows[0];
    const requiredCount = Number(row.requiredCount);
    const submittedCount = Number(row.submittedCount);
    const verifiedCount = Number(row.verifiedCount);
    const rejectedCount = Number(row.rejectedCount) + Number(row.invalidCount);
    let status = "verifying";
    let accountStatus = "active";
    if (requiredCount > 0 && submittedCount === requiredCount && verifiedCount === requiredCount) {
        status = "verified";
    }
    else if (requiredCount > 0 && submittedCount === requiredCount && rejectedCount === requiredCount) {
        status = "rejected";
        accountStatus = "inactive";
    }
    await client.query(`
      update zigo.assistants
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', to_jsonb($2::text), true),
          updated_at = now()
      where id = $1
    `, [assistantId, status]);
    await client.query(`
      update zigo.users u
      set metadata = jsonb_set(coalesce(u.metadata, '{}'::jsonb), '{accountStatus}', to_jsonb($2::text), true),
          updated_at = now()
      from zigo.assistants a
      where a.id = $1 and u.id = a.user_id
    `, [assistantId, accountStatus]);
    return status;
}
export async function decideAssistantVerification(input) {
    const accountStatus = input.decision === "approved" ? "active" : "inactive";
    const result = await pool.query(`
      update zigo.assistants a
      set metadata = jsonb_set(
              jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', to_jsonb($2::text), true),
              '{verificationReason}', to_jsonb(coalesce($3::text, '')), true
            ),
          updated_at = now()
      from zigo.users u
      where a.id = $1
        and u.id = a.user_id
      returning a.user_id as "userId"
    `, [input.assistantId, input.decision, input.reason ?? null]);
    if (!result.rows[0])
        return null;
    await pool.query(`
      update zigo.users
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{accountStatus}', to_jsonb($2::text), true),
          updated_at = now()
      where id = $1
    `, [result.rows[0].userId, accountStatus]);
    await pool.query(`
      update zigo.assistant_documents
      set metadata = jsonb_set(
              jsonb_set(coalesce(metadata, '{}'::jsonb), '{verificationStatus}', to_jsonb($2::text), true),
              '{reason}', to_jsonb(coalesce($3::text, '')), true
            ),
          verified_by_user_id = $4,
          verified_at = now()
      where assistant_id = $1
    `, [input.assistantId, input.decision, input.reason ?? null, input.actorUserId]);
    return result.rows[0];
}
export async function mapAssistantToCluster(input) {
    if (input.isPrimary) {
        await pool.query("update zigo.assistant_cluster_map set is_primary = false where assistant_id = $1", [
            input.assistantId
        ]);
    }
    await pool.query(`
      insert into zigo.assistant_cluster_map (assistant_id, cluster_id, is_primary, is_active)
      values ($1, $2, $3, true)
      on conflict (assistant_id, cluster_id) do update
        set is_primary = excluded.is_primary,
            is_active = true
    `, [input.assistantId, input.clusterId, input.isPrimary ?? false]);
    if (input.isPrimary) {
        await pool.query("update zigo.assistants set current_cluster_id = $2, updated_at = now() where id = $1", [input.assistantId, input.clusterId]);
    }
}
export async function upsertAssistantVehicle(input) {
    const result = await pool.query(`
      insert into zigo.assistant_vehicles
        (assistant_id, vehicle_type, registration_number, make, model, color)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (assistant_id, registration_number) do update
        set vehicle_type = excluded.vehicle_type,
            make = excluded.make,
            model = excluded.model,
            color = excluded.color,
            updated_at = now()
      returning id
    `, [
        input.assistantId,
        input.vehicleType,
        input.registrationNumber,
        input.make ?? null,
        input.model ?? null,
        input.color ?? null
    ]);
    return result.rows[0];
}
export async function getAssistantVehicle(vehicleId) {
    const result = await pool.query(`
      select
        av.id,
        av.assistant_id as "assistantId",
        a.assistant_code as "assistantCode",
        av.vehicle_type as "vehicleType",
        av.registration_number as "registrationNumber",
        av.make,
        av.model,
        av.color,
        av.verification_status as "verificationStatus",
        av.created_at as "createdAt",
        av.updated_at as "updatedAt"
      from zigo.assistant_vehicles av
      join zigo.assistants a on a.id = av.assistant_id
      where av.id = $1 and coalesce(av.is_deleted, false) = false
      limit 1
    `, [vehicleId]);
    return result.rows[0] ?? null;
}
export async function updateAssistantVehicle(vehicleId, input) {
    const result = await pool.query(`
      update zigo.assistant_vehicles
      set vehicle_type = $2,
          registration_number = $3,
          make = $4,
          model = $5,
          color = $6,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [vehicleId, input.vehicleType, input.registrationNumber, input.make ?? null, input.model ?? null, input.color ?? null]);
    return result.rows[0] ?? null;
}
export async function deleteAssistantVehicle(vehicleId, actorUserId) {
    const result = await pool.query(`
      update zigo.assistant_vehicles
      set is_deleted = true,
          deleted_by = $2,
          deleted_at = now(),
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [vehicleId, actorUserId]);
    return result.rows[0] ?? null;
}
export async function listVehicleDocuments(vehicleId) {
    const result = await pool.query(`
      select
        avd.id,
        avd.vehicle_id as "vehicleId",
        dt.code as "documentTypeCode",
        dt.name as "documentTypeName",
        f.original_name as "originalName",
        f.mime_type as "mimeType",
        f.object_key as "previewUrl",
        avd.verification_status as "verificationStatus",
        avd.created_at as "createdAt"
      from zigo.assistant_vehicle_documents avd
      join zigo.document_types dt on dt.id = avd.document_type_id
      left join zigo.files f on f.id = avd.file_id
      where avd.vehicle_id = $1
      order by dt.code
    `, [vehicleId]);
    return result.rows;
}
export async function attachVehicleDocument(input) {
    const documentSavePath = await getMediaPathValue(MEDIA_PATH_SETTING_KEYS.document);
    const file = await pool.query(`
      insert into zigo.files (storage_provider, bucket, object_key, original_name, mime_type, metadata)
      values ('external_url', $4, $1, $2, $3, jsonb_build_object('preview', true, 'savePath', $4::text))
      returning id
    `, [input.previewUrl, input.originalName, input.mimeType ?? null, documentSavePath]);
    await pool.query(`
      insert into zigo.assistant_vehicle_documents
        (vehicle_id, document_type_id, file_id, verification_status)
      values ($1, $2, $3, 'pending')
      on conflict (vehicle_id, document_type_id) do update
        set file_id = excluded.file_id,
            verification_status = 'pending'
    `, [input.vehicleId, input.documentTypeId, file.rows[0].id]);
}
