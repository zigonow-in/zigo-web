import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { HttpError } from "../src/http/errors.js";
import {
  createServicePillar,
  deleteServicePillar,
  listServicePillars,
  updateServicePillar
} from "../src/modules/masters/servicePillars.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const target = new URL(connectionString);
if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(target.hostname.toLowerCase())) {
  throw new Error(`Service Pillar CRUD test is local-only; refused ${target.hostname}.`);
}

const code = `TEST_PILLAR_${Date.now()}`;
let testId = "";

try {
  const created = await createServicePillar({
    code,
    name: "Temporary Pillar",
    description: "Created by the local CRUD verification.",
    displayOrder: 99999,
    status: "draft"
  });
  if (!created?.id) throw new Error("Pillar creation did not return an ID.");
  testId = created.id;

  const updated = await updateServicePillar(testId, {
    code,
    name: "Updated Temporary Pillar",
    description: null,
    displayOrder: 99998,
    status: "inactive"
  });
  if (updated?.name !== "Updated Temporary Pillar" || updated?.status !== "inactive") {
    throw new Error("Pillar update did not persist the requested values.");
  }

  let duplicateRejected = false;
  try {
    await createServicePillar({
      code,
      name: "Duplicate Temporary Pillar",
      description: null,
      displayOrder: 99999,
      status: "draft"
    });
  } catch (error) {
    duplicateRejected = error instanceof HttpError && error.statusCode === 409;
  }
  if (!duplicateRejected) throw new Error("Duplicate pillar code was not rejected.");

  const mapped = (await listServicePillars()).find((pillar) => Number(pillar.serviceCount) > 0);
  if (!mapped) throw new Error("No mapped pillar was available for deletion-guard verification.");
  let mappedDeleteRejected = false;
  try {
    await deleteServicePillar(mapped.id, "local-test");
  } catch (error) {
    mappedDeleteRejected = error instanceof HttpError && error.statusCode === 409;
  }
  if (!mappedDeleteRejected) throw new Error("Mapped pillar deletion was not rejected.");

  await deleteServicePillar(testId, "local-test");
  testId = "";
  if ((await listServicePillars()).some((pillar) => pillar.code === code)) {
    throw new Error("Temporary pillar was not removed.");
  }

  console.log(JSON.stringify({
    target: `${target.hostname}:${target.port || "5432"}/${target.pathname.slice(1)}`,
    create: "passed",
    update: "passed",
    duplicateCode: "passed",
    mappedDeleteGuard: "passed",
    delete: "passed"
  }, null, 2));
} finally {
  if (testId) {
    await pool.query("delete from zigo.service_pillars where id = $1", [testId]);
  }
  await pool.end();
}
