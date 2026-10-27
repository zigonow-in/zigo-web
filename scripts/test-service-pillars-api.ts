import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { signAdminAccessToken } from "../src/modules/auth/token.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseTarget = new URL(connectionString);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
if (!localHosts.has(databaseTarget.hostname.toLowerCase())) {
  throw new Error(`Service Pillar API test is local-only; refused ${databaseTarget.hostname}.`);
}

const basePath = String(process.env.APP_BASE_PATH || "").trim().replace(/\/+$/, "");
const endpoint = `http://127.0.0.1:${process.env.PORT || "4003"}${basePath}/masters/service-pillars`;
const serviceEndpoint = `http://127.0.0.1:${process.env.PORT || "4003"}${basePath}/masters/personal-assistant-services`;
const tasksEndpoint = `http://127.0.0.1:${process.env.PORT || "4003"}${basePath}/masters/personal-assistant-service-tasks`;
const code = `TEST_API_PILLAR_${Date.now()}`;
let testId = "";

async function apiRequest(path = "", options: RequestInit = {}) {
  return requestAt(endpoint, path, options);
}

async function requestAt(targetEndpoint: string, path = "", options: RequestInit = {}) {
  const response = await fetch(`${targetEndpoint}${path}`, {
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

try {
  const listed = await apiRequest();
  if (!listed.response.ok || !Array.isArray(listed.payload.data) || listed.payload.data.length < 5) {
    throw new Error(`Pillar listing failed with HTTP ${listed.response.status}.`);
  }
  const serviceList = await requestAt(serviceEndpoint);
  if (!serviceList.response.ok || !Array.isArray(serviceList.payload.data) || serviceList.payload.data.length < 25) {
    throw new Error(`Service Master listing failed with HTTP ${serviceList.response.status}.`);
  }
  const tasks = await requestAt(tasksEndpoint);
  if (!tasks.response.ok || !Array.isArray(tasks.payload.data) || tasks.payload.data.length < 100) {
    throw new Error(`Service task listing failed with HTTP ${tasks.response.status}.`);
  }

  const created = await apiRequest("", {
    method: "POST",
    body: JSON.stringify({
      code,
      name: "Temporary API Pillar",
      description: "Created by the local API verification.",
      displayOrder: 99999,
      status: "draft"
    })
  });
  if (created.response.status !== 201 || !created.payload.data?.id) {
    throw new Error(`Pillar creation failed with HTTP ${created.response.status}.`);
  }
  testId = created.payload.data.id;

  const updated = await apiRequest(`/${testId}`, {
    method: "PUT",
    body: JSON.stringify({
      code,
      name: "Updated Temporary API Pillar",
      description: "",
      displayOrder: 99998,
      status: "inactive"
    })
  });
  if (!updated.response.ok || updated.payload.data?.status !== "inactive") {
    throw new Error(`Pillar update failed with HTTP ${updated.response.status}.`);
  }

  const duplicate = await apiRequest("", {
    method: "POST",
    body: JSON.stringify({
      code,
      name: "Duplicate Temporary API Pillar",
      description: "",
      displayOrder: 99999,
      status: "draft"
    })
  });
  if (duplicate.response.status !== 409) {
    throw new Error(`Duplicate code should return HTTP 409, received ${duplicate.response.status}.`);
  }

  const mapped = listed.payload.data.find((pillar: { serviceCount?: number }) => Number(pillar.serviceCount) > 0);
  if (!mapped) throw new Error("No mapped pillar was available for API deletion-guard verification.");
  const mappedDelete = await apiRequest(`/${mapped.id}`, { method: "DELETE" });
  if (mappedDelete.response.status !== 409) {
    throw new Error(`Mapped deletion should return HTTP 409, received ${mappedDelete.response.status}.`);
  }

  const removed = await apiRequest(`/${testId}`, { method: "DELETE" });
  if (!removed.response.ok) throw new Error(`Pillar deletion failed with HTTP ${removed.response.status}.`);
  testId = "";

  console.log(JSON.stringify({
    endpoint,
    list: "passed",
    serviceMasterList: "passed",
    serviceTaskList: "passed",
    create: "passed",
    update: "passed",
    duplicateCode: "passed",
    mappedDeleteGuard: "passed",
    delete: "passed"
  }, null, 2));
} finally {
  if (testId) await pool.query("delete from zigo.service_pillars where id = $1", [testId]);
  await pool.end();
}
