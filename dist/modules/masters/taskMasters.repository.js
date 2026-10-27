import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
const managedTaskSourceSql = "task.metadata ->> 'catalogSource' in ('zigo_personal_assistant_v2', 'zigo_personal_assistant_admin')";
const actionSelect = `
  select
    action.id,
    action.code,
    action.name,
    action.description,
    action.parameter_schema as "parameterSchema",
    action.status,
    action.version,
    count(distinct mapping.task_id)::int as "taskCount",
    coalesce(string_agg(distinct task.name, ', ' order by task.name) filter (where task.name is not null), '') as "taskNames"
  from zigo.task_primitives action
  left join zigo.task_primitive_mappings mapping on mapping.primitive_id = action.id
  left join zigo.task_definitions task on task.id = mapping.task_id
`;
const taskSelect = `
  select
    task.id,
    task.code,
    task.name,
    task.description,
    task.risk_tier as "riskTier",
    task.status,
    coalesce(nullif(task.metadata ->> 'displayOrder', '')::int, 0) as "displayOrder",
    count(distinct mapping.primitive_id)::int as "actionCount",
    coalesce(array_agg(mapping.primitive_id order by mapping.sequence_no) filter (where mapping.primitive_id is not null), '{}'::uuid[]) as "actionIds",
    coalesce(array_agg(action.code order by mapping.sequence_no) filter (where action.code is not null), '{}'::text[]) as "actionCodes",
    coalesce(string_agg(action.name, ', ' order by mapping.sequence_no) filter (where action.name is not null), '') as "actionNames"
  from zigo.task_definitions task
  left join zigo.task_primitive_mappings mapping on mapping.task_id = task.id
  left join zigo.task_primitives action on action.id = mapping.primitive_id
  where ${managedTaskSourceSql}
`;
export async function listPersonalAssistantActions() {
    const result = await pool.query(`${actionSelect}
    group by action.id
    order by lower(action.name), action.code, action.id`);
    return result.rows;
}
export async function listPersonalAssistantTaskDefinitions() {
    const result = await pool.query(`${taskSelect}
    group by task.id
    order by "displayOrder", lower(task.name), task.id`);
    return result.rows;
}
async function saveAction(id, input) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    try {
        const result = id
            ? await pool.query(`
          update zigo.task_primitives
          set code = $1,
              name = $2,
              description = $3,
              status = $4::zigo.lifecycle_status,
              version = version + 1
          where id = $5
          returning id
        `, [code, name, description, input.status, id])
            : await pool.query(`
          insert into zigo.task_primitives (code, name, description, status)
          values ($1, $2, $3, $4::zigo.lifecycle_status)
          returning id
        `, [code, name, description, input.status]);
        if (!result.rows[0])
            return null;
        const saved = await pool.query(`${actionSelect}
      where action.id = $1
      group by action.id`, [result.rows[0].id]);
        return saved.rows[0] ?? null;
    }
    catch (error) {
        if (error.code === "23505") {
            throw new HttpError(409, "An action with this code already exists.");
        }
        throw error;
    }
}
export const createPersonalAssistantAction = (input) => saveAction(null, input);
export const updatePersonalAssistantAction = (id, input) => saveAction(id, input);
export async function deletePersonalAssistantAction(id) {
    const result = await pool.query(`
    update zigo.task_primitives
    set status = 'retired'::zigo.lifecycle_status,
        version = version + 1
    where id = $1
      and status <> 'retired'::zigo.lifecycle_status
    returning id
  `, [id]);
    return result.rows[0] ?? null;
}
async function saveTask(id, input) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const actionIds = [...new Set(input.actionIds)];
    if (!actionIds.length)
        throw new HttpError(400, "Map at least one action to the task.");
    const client = await pool.connect();
    try {
        await client.query("begin");
        const actionCheck = await client.query(`
      select count(*)::int as count
      from zigo.task_primitives
      where id = any($1::uuid[])
        and status <> 'retired'::zigo.lifecycle_status
    `, [actionIds]);
        if (actionCheck.rows[0]?.count !== actionIds.length) {
            throw new HttpError(400, "One or more selected actions are no longer available.");
        }
        const metadata = JSON.stringify({
            catalogSource: "zigo_personal_assistant_admin",
            displayOrder: 0
        });
        const result = id
            ? await client.query(`
          update zigo.task_definitions as task
          set code = $1,
              name = $2,
              description = $3,
              risk_tier = $4,
              status = $5::zigo.lifecycle_status,
              metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
              updated_at = now()
          where id = $7
            and ${managedTaskSourceSql}
          returning id
        `, [code, name, description, input.riskTier, input.status, metadata, id])
            : await client.query(`
          insert into zigo.task_definitions (
            code, name, description, risk_tier, status, metadata
          )
          values ($1, $2, $3, $4, $5::zigo.lifecycle_status, $6::jsonb)
          returning id
        `, [code, name, description, input.riskTier, input.status, metadata]);
        if (!result.rows[0]) {
            await client.query("rollback");
            return null;
        }
        const taskId = result.rows[0].id;
        await client.query("delete from zigo.task_primitive_mappings where task_id = $1", [taskId]);
        await client.query(`
      insert into zigo.task_primitive_mappings (task_id, primitive_id, sequence_no)
      select $1, primitive_id, ordinality::int
      from unnest($2::uuid[]) with ordinality as mapped(primitive_id, ordinality)
    `, [taskId, actionIds]);
        await client.query("commit");
        const saved = await pool.query(`${taskSelect}
      and task.id = $1
      group by task.id`, [taskId]);
        return saved.rows[0] ?? null;
    }
    catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (error.code === "23505") {
            throw new HttpError(409, "A task with this code already exists.");
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export const createPersonalAssistantTask = (input) => saveTask(null, input);
export const updatePersonalAssistantTask = (id, input) => saveTask(id, input);
export async function deletePersonalAssistantTask(id) {
    const result = await pool.query(`
    update zigo.task_definitions task
    set status = 'retired'::zigo.lifecycle_status,
        updated_at = now()
    where task.id = $1
      and ${managedTaskSourceSql}
      and task.status <> 'retired'::zigo.lifecycle_status
    returning task.id
  `, [id]);
    return result.rows[0] ?? null;
}
