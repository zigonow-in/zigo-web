import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { HttpError } from "../src/http/errors.js";
import {
  createPersonalAssistantAction,
  createPersonalAssistantTask,
  listPersonalAssistantActions,
  listPersonalAssistantTaskDefinitions,
  updatePersonalAssistantAction,
  updatePersonalAssistantTask
} from "../src/modules/masters/taskMasters.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const target = new URL(connectionString);
if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(target.hostname.toLowerCase())) {
  throw new Error(`Task Master CRUD test is local-only; refused ${target.hostname}.`);
}

const actionCode = `TEST_ACTION_${Date.now()}`;
const secondActionCode = `${actionCode}_SECOND`;
const taskCode = `TEST_TASK_${Date.now()}`;
let actionId = "";
let secondActionId = "";
let taskId = "";

try {
  const action = await createPersonalAssistantAction({
    code: actionCode,
    name: "Temporary Action",
    description: "Created by local Task Master verification.",
    status: "draft",
    userId: "local-test"
  });
  if (!action?.id) throw new Error("Action creation did not return an ID.");
  actionId = action.id;

  const secondAction = await createPersonalAssistantAction({
    code: secondActionCode,
    name: "Temporary Second Action",
    description: null,
    status: "draft",
    userId: "local-test"
  });
  if (!secondAction?.id) throw new Error("Second action creation did not return an ID.");
  secondActionId = secondAction.id;

  const updatedAction = await updatePersonalAssistantAction(actionId, {
    code: actionCode,
    name: "Updated Temporary Action",
    description: null,
    status: "active",
    userId: "local-test"
  });
  if (updatedAction?.name !== "Updated Temporary Action" || updatedAction?.status !== "active") {
    throw new Error("Action update did not persist the requested values.");
  }

  const task = await createPersonalAssistantTask({
    code: taskCode,
    name: "Temporary Task",
    description: "Created by local Task Master verification.",
    riskTier: "standard",
    actionIds: [actionId, secondActionId],
    status: "draft",
    userId: "local-test"
  });
  if (!task?.id || Number(task.actionCount) !== 2) throw new Error("Task creation did not persist multiple actions.");
  taskId = task.id;

  const updatedTask = await updatePersonalAssistantTask(taskId, {
    code: taskCode,
    name: "Updated Temporary Task",
    description: null,
    riskTier: "controlled",
    actionIds: [secondActionId],
    status: "inactive",
    userId: "local-test"
  });
  if (updatedTask?.name !== "Updated Temporary Task" || Number(updatedTask?.actionCount) !== 1 || updatedTask?.riskTier !== "controlled") {
    throw new Error("Task update did not persist the action mapping.");
  }

  let missingActionRejected = false;
  try {
    await updatePersonalAssistantTask(taskId, {
      code: taskCode,
      name: "Updated Temporary Task",
      description: null,
      riskTier: "standard",
      actionIds: ["00000000-0000-0000-0000-000000000000"],
      status: "draft",
      userId: "local-test"
    });
  } catch (error) {
    missingActionRejected = error instanceof HttpError && error.statusCode === 400;
  }
  if (!missingActionRejected) throw new Error("Invalid action mapping was not rejected.");

  if (!(await listPersonalAssistantActions()).some(item => item.id === actionId)) throw new Error("Action listing did not return the created action.");
  if (!(await listPersonalAssistantTaskDefinitions()).some(item => item.id === taskId)) throw new Error("Task listing did not return the created task.");

  console.log(JSON.stringify({
    target: `${target.hostname}:${target.port || "5432"}/${target.pathname.slice(1)}`,
    actionCreate: "passed",
    actionUpdate: "passed",
    taskCreateWithMultipleActions: "passed",
    taskUpdate: "passed",
    invalidActionMapping: "passed",
    lists: "passed"
  }, null, 2));
} finally {
  if (taskId) await pool.query("delete from zigo.task_definitions where id = $1", [taskId]);
  if (actionId) await pool.query("delete from zigo.task_primitives where id = $1", [actionId]);
  if (secondActionId) await pool.query("delete from zigo.task_primitives where id = $1", [secondActionId]);
  await pool.end();
}
