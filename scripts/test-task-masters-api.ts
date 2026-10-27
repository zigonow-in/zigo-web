import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { signAdminAccessToken } from "../src/modules/auth/token.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseTarget = new URL(connectionString);
if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(databaseTarget.hostname.toLowerCase())) {
  throw new Error(`Task Master API test is local-only; refused ${databaseTarget.hostname}.`);
}

const basePath = String(process.env.APP_BASE_PATH || "").trim().replace(/\/+$/, "");
const baseUrl = `http://127.0.0.1:${process.env.PORT || "4003"}${basePath}/masters`;
const actionEndpoint = `${baseUrl}/personal-assistant-actions`;
const taskEndpoint = `${baseUrl}/personal-assistant-tasks`;
const code = `TEST_API_ACTION_${Date.now()}`;
const taskCode = `TEST_API_TASK_${Date.now()}`;
let actionId = "";
let taskId = "";

const adminResult = await pool.query<{ id: string; roles: string[] }>(`
  select user_account.id, array_agg(distinct role.code) as roles
  from zigo.users user_account
  join zigo.user_roles user_role on user_role.user_id = user_account.id
  join zigo.roles role on role.id = user_role.role_id
  where user_account.deleted_at is null
    and coalesce(user_role.is_deleted, false) = false
    and coalesce(user_role.is_active, true) = true
    and coalesce(role.is_deleted, false) = false
    and role.code = 'super_admin'
  group by user_account.id
  limit 1
`);
const admin = adminResult.rows[0];
if (!admin) throw new Error("No active local Super Admin is available for API verification.");
const token = signAdminAccessToken({ userId: admin.id, roles: admin.roles }).token;

async function requestAt(target: string, options: RequestInit = {}) {
  const response = await fetch(target, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

try {
  const actionList = await requestAt(actionEndpoint);
  if (!actionList.response.ok || !Array.isArray(actionList.payload.data)) throw new Error(`Action listing failed with HTTP ${actionList.response.status}.`);
  const taskList = await requestAt(taskEndpoint);
  if (!taskList.response.ok || !Array.isArray(taskList.payload.data) || taskList.payload.data.length < 100) throw new Error(`Task listing failed with HTTP ${taskList.response.status}.`);

  const actionCreated = await requestAt(actionEndpoint, { method: "POST", body: JSON.stringify({ code, name: "Temporary API Action", description: "API verification", status: "draft" }) });
  if (actionCreated.response.status !== 201 || !actionCreated.payload.data?.id) throw new Error(`Action creation failed with HTTP ${actionCreated.response.status}.`);
  actionId = actionCreated.payload.data.id;

  const taskCreated = await requestAt(taskEndpoint, { method: "POST", body: JSON.stringify({ code: taskCode, name: "Temporary API Task", description: "API verification", riskTier: "standard", actionIds: [actionId], status: "draft" }) });
  if (taskCreated.response.status !== 201 || !taskCreated.payload.data?.id || Number(taskCreated.payload.data.actionCount) !== 1) throw new Error(`Task creation failed with HTTP ${taskCreated.response.status}.`);
  taskId = taskCreated.payload.data.id;

  const deletedTask = await requestAt(`${taskEndpoint}/${taskId}`, { method: "DELETE" });
  if (!deletedTask.response.ok) throw new Error(`Task deletion failed with HTTP ${deletedTask.response.status}.`);
  taskId = "";
  const deletedAction = await requestAt(`${actionEndpoint}/${actionId}`, { method: "DELETE" });
  if (!deletedAction.response.ok) throw new Error(`Action deletion failed with HTTP ${deletedAction.response.status}.`);
  actionId = "";

  console.log(JSON.stringify({ actionList: "passed", taskList: "passed", actionCreate: "passed", taskCreate: "passed", taskDelete: "passed", actionDelete: "passed" }, null, 2));
} finally {
  if (taskId) await pool.query("delete from zigo.task_definitions where id = $1", [taskId]);
  if (actionId) await pool.query("delete from zigo.task_primitives where id = $1", [actionId]);
  await pool.end();
}
