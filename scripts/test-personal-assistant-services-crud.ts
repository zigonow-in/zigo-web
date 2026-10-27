import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { HttpError } from "../src/http/errors.js";
import {
  createPersonalAssistantService,
  deletePersonalAssistantService,
  listPersonalAssistantTasks,
  listPersonalAssistantServices,
  updatePersonalAssistantService
} from "../src/modules/masters/personalAssistantServices.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const target = new URL(connectionString);
if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(target.hostname.toLowerCase())) {
  throw new Error(`Service Master CRUD test is local-only; refused ${target.hostname}.`);
}

const pillarResult = await pool.query<{ id: string }>(`
  select id from zigo.service_pillars where code = 'PERSONAL_LIFE' limit 1
`);
const pillarId = pillarResult.rows[0]?.id;
if (!pillarId) throw new Error("PERSONAL_LIFE pillar is required for the local Service Master test.");
const userResult = await pool.query<{ id: string }>(`
  select id from zigo.users where deleted_at is null limit 1
`);
const actorId = userResult.rows[0]?.id;
if (!actorId) throw new Error("An active local user is required for the Service Master test.");
const taskIds = (await listPersonalAssistantTasks()).slice(0, 2).map((task) => task.id as string);
if (taskIds.length < 2) throw new Error("At least two active V2 tasks are required for the local Service Master test.");

const code = `TEST_SERVICE_${Date.now()}`;
let testId = "";

try {
  const created = await createPersonalAssistantService({
    code,
    name: "Temporary Service",
    description: "Created by the local Service Master verification.",
    pillarIds: [pillarId],
    taskIds: [taskIds[0]],
    displayOrder: 99999,
    status: "draft",
    isActive: false,
    isEnabled: false,
    userId: actorId
  });
  if (!created?.id) throw new Error("Service creation did not return an ID.");
  testId = created.id;

  const updated = await updatePersonalAssistantService(testId, {
    code,
    name: "Updated Temporary Service",
    description: null,
    pillarIds: [pillarId],
    taskIds,
    displayOrder: 99998,
    status: "inactive",
    isActive: false,
    isEnabled: false,
    userId: actorId
  });
  if (updated?.name !== "Updated Temporary Service" || Number(updated?.taskCount) !== taskIds.length || !taskIds.every((id) => updated?.taskIds?.includes(id))) {
    throw new Error("Service update did not persist the requested values.");
  }

  let invalidTaskRejected = false;
  try {
    await updatePersonalAssistantService(testId, {
      code,
      name: "Updated Temporary Service",
      description: null,
      pillarIds: [pillarId],
      taskIds: ["00000000-0000-0000-0000-000000000000"],
      displayOrder: 99998,
      status: "inactive",
      isActive: false,
      isEnabled: false,
      userId: actorId
    });
  } catch (error) {
    invalidTaskRejected = error instanceof HttpError && error.statusCode === 400;
  }
  if (!invalidTaskRejected) throw new Error("Invalid task mapping was not rejected.");

  let duplicateRejected = false;
  try {
    await createPersonalAssistantService({
      code,
      name: "Duplicate Temporary Service",
      description: null,
      pillarIds: [pillarId],
      taskIds: [taskIds[0]],
      displayOrder: 99999,
      status: "draft",
      isActive: false,
      isEnabled: false,
      userId: actorId
    });
  } catch (error) {
    duplicateRejected = error instanceof HttpError && error.statusCode === 409;
  }
  if (!duplicateRejected) throw new Error("Duplicate service code was not rejected.");

  if (!(await listPersonalAssistantServices()).some(service => service.id === testId)) {
    throw new Error("Created service was not returned by the V2 Service Master listing.");
  }

  const retiredId = testId;
  await deletePersonalAssistantService(retiredId, actorId);
  await pool.query("delete from zigo.services where id = $1", [retiredId]);
  testId = "";
  console.log(JSON.stringify({
    target: `${target.hostname}:${target.port || "5432"}/${target.pathname.slice(1)}`,
    list: "passed",
    create: "passed",
    update: "passed",
    invalidTaskMapping: "passed",
    duplicateCode: "passed",
    retire: "passed"
  }, null, 2));
} finally {
  if (testId) {
    await pool.query("update zigo.services set is_deleted = true, is_active = false, is_enabled = false where id = $1", [testId]);
  }
  await pool.end();
}
