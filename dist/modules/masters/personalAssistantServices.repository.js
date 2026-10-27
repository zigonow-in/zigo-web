import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
const serviceSelect = `
  select
    service.id,
    service.code,
    service.name,
    service.description,
    service.sort_order as "displayOrder",
    service.status,
    service.is_active as "isActive",
    service.is_enabled as "isEnabled",
    count(distinct task.id)::int as "taskCount",
    coalesce(array_agg(distinct task.id) filter (where task.id is not null), '{}'::uuid[]) as "taskIds",
    coalesce(string_agg(distinct task.name, ', ' order by task.name) filter (where task.name is not null), '') as "taskNames",
    coalesce(array_agg(distinct pillar.id) filter (where pillar.id is not null), '{}') as "pillarIds",
    coalesce(string_agg(distinct pillar.name, ', ' order by pillar.name) filter (where pillar.name is not null), '') as "pillarNames"
  from zigo.services service
  left join zigo.service_pillar_mappings pillar_mapping on pillar_mapping.service_id = service.id
  left join zigo.service_pillars pillar on pillar.id = pillar_mapping.pillar_id
  left join zigo.service_task_mappings task_mapping on task_mapping.service_id = service.id
  left join zigo.task_definitions task on task.id = task_mapping.task_id
    and task.status <> 'retired'::zigo.lifecycle_status
  where service.is_deleted = false
    and service.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
`;
export async function listPersonalAssistantServices() {
    const result = await pool.query(`${serviceSelect}
    group by service.id
    order by service.sort_order, lower(service.name), service.id`);
    return result.rows;
}
export async function listPersonalAssistantTasks() {
    const result = await pool.query(`
    select
      id,
      code,
      name,
      description,
      risk_tier as "riskTier",
      status,
      coalesce(nullif(metadata ->> 'displayOrder', '')::int, 0) as "displayOrder"
    from zigo.task_definitions
    where metadata ->> 'catalogSource' in ('zigo_personal_assistant_v2', 'zigo_personal_assistant_admin')
      and status <> 'retired'::zigo.lifecycle_status
    order by "displayOrder", lower(name), id
  `);
    return result.rows;
}
async function savePersonalAssistantService(id, input) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const pillarIds = [...new Set(input.pillarIds)];
    const taskIds = [...new Set(input.taskIds)];
    if (!pillarIds.length)
        throw new HttpError(400, "Select at least one service pillar.");
    if (!taskIds.length)
        throw new HttpError(400, "Map at least one task to the service.");
    const client = await pool.connect();
    try {
        await client.query("begin");
        const pillarCheck = await client.query(`
      select count(*)::int as count
      from zigo.service_pillars
      where id = any($1::uuid[])
    `, [pillarIds]);
        if (pillarCheck.rows[0]?.count !== pillarIds.length) {
            throw new HttpError(400, "One or more selected pillars are no longer available.");
        }
        const taskCheck = await client.query(`
      select count(*)::int as count
      from zigo.task_definitions
      where id = any($1::uuid[])
        and metadata ->> 'catalogSource' in ('zigo_personal_assistant_v2', 'zigo_personal_assistant_admin')
        and status <> 'retired'::zigo.lifecycle_status
    `, [taskIds]);
        if (taskCheck.rows[0]?.count !== taskIds.length) {
            throw new HttpError(400, "One or more selected tasks are no longer available.");
        }
        const values = [
            code,
            name,
            description,
            input.displayOrder,
            input.status,
            input.isActive,
            input.isEnabled,
            JSON.stringify({
                catalogSource: "zigo_personal_assistant_v2",
                requiresApproval: input.status !== "active",
                pillarIds
            }),
            input.userId
        ];
        const result = id
            ? await client.query(`
          update zigo.services
          set code = $1,
              name = $2,
              description = $3,
              default_booking_mode = 'TASK',
              sort_order = $4,
              status = $5::zigo.lifecycle_status,
              is_active = $6,
              is_enabled = $7,
              metadata = coalesce(metadata, '{}'::jsonb) || $8::jsonb,
              updated_by = $9,
              updated_at = now()
          where id = $10
            and is_deleted = false
            and metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
          returning id
        `, [...values, id])
            : await client.query(`
          insert into zigo.services (
            code, name, description, default_booking_mode, sort_order,
            status, is_active, is_enabled, metadata, created_by, updated_by
          )
          values ($1, $2, $3, 'TASK', $4, $5::zigo.lifecycle_status, $6, $7, $8::jsonb, $9, $9)
          returning id
        `, values);
        if (!result.rows[0]) {
            await client.query("rollback");
            return null;
        }
        const serviceId = result.rows[0].id;
        await client.query("delete from zigo.service_pillar_mappings where service_id = $1", [serviceId]);
        for (const pillarId of pillarIds) {
            await client.query(`
        insert into zigo.service_pillar_mappings (service_id, pillar_id, is_primary)
        values ($1, $2, $3)
      `, [serviceId, pillarId, pillarId === pillarIds[0]]);
        }
        await client.query("delete from zigo.service_task_mappings where service_id = $1", [serviceId]);
        await client.query(`
      insert into zigo.service_task_mappings (service_id, task_id, display_order)
      select $1, task_id, ordinality::int
      from unnest($2::uuid[]) with ordinality as mapped(task_id, ordinality)
    `, [serviceId, taskIds]);
        await client.query("commit");
        const saved = await pool.query(`${serviceSelect}
      and service.id = $1
      group by service.id`, [serviceId]);
        return saved.rows[0] ?? null;
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (error.code === "23505") {
            throw new HttpError(409, "A service with this code already exists.");
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export const createPersonalAssistantService = (input) => savePersonalAssistantService(null, input);
export const updatePersonalAssistantService = (id, input) => savePersonalAssistantService(id, input);
export async function deletePersonalAssistantService(id, userId) {
    const result = await pool.query(`
    update zigo.services
    set is_deleted = true,
        is_active = false,
        is_enabled = false,
        status = 'retired'::zigo.lifecycle_status,
        deleted_by = $2,
        deleted_at = now(),
        updated_by = $2,
        updated_at = now()
    where id = $1
      and is_deleted = false
      and metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
    returning id
  `, [id, userId]);
    return result.rows[0] ?? null;
}
