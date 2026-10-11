import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(repoRoot, "database", "release-migrations");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const target = parseDatabaseUrl(connectionString);
const isLocalTarget = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.host.toLowerCase());
const statusOnly = process.argv.includes("--status");
const localMode = process.argv.includes("--local");
const productionMode = process.argv.includes("--production");
const confirmedHost = optionValue("--confirm-host");

if (localMode && productionMode) throw new Error("Choose either --local or --production, not both.");
if (localMode && !isLocalTarget) throw new Error("--local cannot be used with a remote database.");
if ((productionMode || !isLocalTarget) && confirmedHost.toLowerCase() !== target.host.toLowerCase()) {
  throw new Error(`Remote migration refused. Re-run with --confirm-host=${target.host}.`);
}
if (!statusOnly && isLocalTarget && !localMode && !productionMode) {
  throw new Error("Use --local for development or --production with a verified backup for production.");
}
if (!statusOnly && (productionMode || !isLocalTarget)) await verifyBackup(target);

const migrations = await loadMigrations();
const client = new pg.Client({ connectionString, application_name: "zigo-release-migration" });
await client.connect();
let lockHeld = false;

try {
  const identity = (await client.query(`
    select current_database() as database,
      current_user as "databaseUser",
      coalesce(inet_server_addr()::text, 'local-socket') as "serverAddress",
      pg_is_in_recovery() as "inRecovery",
      current_setting('server_version') as "serverVersion"
  `)).rows[0];
  if (identity.database !== target.database) throw new Error("Connected database does not match DATABASE_URL.");
  if (identity.inRecovery) throw new Error("Migration refused: the target is a read-only recovery replica.");

  const applied = await readAppliedMigrations(client);
  printStatus(identity, migrations, applied);
  if (statusOnly) {
    process.exitCode = 0;
  } else {
    const lock = await client.query("select pg_try_advisory_lock(7249462011) as locked");
    if (!lock.rows[0]?.locked) throw new Error("Another release migration is already running.");
    lockHeld = true;

    await client.query("create schema if not exists zigo");
    await client.query(`
      create table if not exists zigo.release_schema_migrations (
        id text primary key,
        checksum_sha256 text not null,
        execution_mode text not null,
        execution_ms integer not null,
        release_version text,
        applied_at timestamptz not null default now()
      )
    `);

    const currentApplied = await readAppliedMigrations(client);
    for (const migration of migrations) {
      const existing = currentApplied.get(migration.id);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(`Migration checksum changed after apply: ${migration.id}`);
        }
        console.log(`skip ${migration.id} (already applied)`);
        continue;
      }
      await applyMigration(client, migration);
    }

    await verifyReleaseSchema(client);
    console.log("Release migrations completed and schema verification passed.");
  }
} finally {
  if (lockHeld) await client.query("select pg_advisory_unlock(7249462011)").catch(() => undefined);
  await client.end();
}

async function loadMigrations() {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const name of names) {
    const filePath = path.join(migrationsDir, name);
    const sql = await readFile(filePath, "utf8");
    assertAdditiveMigration(name, sql);
    migrations.push({
      id: name.replace(/\.sql$/, ""),
      name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
      mode: name.endsWith(".nontransactional.sql") ? "nontransactional" : "transactional"
    });
  }
  if (!migrations.length) throw new Error("No release migrations were found.");
  return migrations;
}

function assertAdditiveMigration(name, sql) {
  const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
  const forbidden = [
    /\bdrop\s+(table|schema|database)\b/i,
    /\btruncate\b/i,
    /\bdelete\s+from\b/i,
    /\balter\s+table[\s\S]{0,200}\bdrop\s+column\b/i,
    /\bvacuum\s+full\b/i
  ];
  if (forbidden.some((pattern) => pattern.test(withoutComments))) {
    throw new Error(`Destructive SQL is not allowed in release migration ${name}.`);
  }
  if (name.endsWith(".nontransactional.sql")) {
    const statements = withoutComments.split(";").map((entry) => entry.trim()).filter(Boolean);
    if (statements.length !== 1 || !/^create\s+index\s+concurrently\b/i.test(statements[0])) {
      throw new Error(`${name} must contain exactly one CREATE INDEX CONCURRENTLY statement.`);
    }
  }
}

async function readAppliedMigrations(database) {
  const exists = await database.query("select to_regclass('zigo.release_schema_migrations') as relation");
  if (!exists.rows[0]?.relation) return new Map();
  const result = await database.query(`
    select id, checksum_sha256 as checksum, execution_mode as mode, applied_at as "appliedAt"
    from zigo.release_schema_migrations
    order by id
  `);
  return new Map(result.rows.map((row) => [row.id, row]));
}

async function applyMigration(database, migration) {
  const startedAt = Date.now();
  console.log(`apply ${migration.id} (${migration.mode})`);
  if (migration.mode === "transactional") {
    await database.query("begin");
    try {
      await database.query("set local lock_timeout = '5s'");
      await database.query("set local statement_timeout = '10min'");
      await database.query("set local idle_in_transaction_session_timeout = '2min'");
      await database.query(migration.sql);
      await recordMigration(database, migration, Date.now() - startedAt);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
    return;
  }

  try {
    await database.query("set lock_timeout = '5s'");
    await database.query("set statement_timeout = '30min'");
    await database.query(migration.sql);
  } finally {
    await database.query("reset lock_timeout").catch(() => undefined);
    await database.query("reset statement_timeout").catch(() => undefined);
  }
  await recordMigration(database, migration, Date.now() - startedAt);
}

async function recordMigration(database, migration, executionMs) {
  await database.query(`
    insert into zigo.release_schema_migrations
      (id, checksum_sha256, execution_mode, execution_ms, release_version)
    values ($1, $2, $3, $4, $5)
  `, [migration.id, migration.checksum, migration.mode, executionMs, process.env.RELEASE_VERSION || null]);
}

async function verifyReleaseSchema(database) {
  const requiredColumns = [
    ["booking_task_update_reads", "delivered_at"],
    ["assistant_availability", "gps_captured_at"],
    ["assistant_availability", "heartbeat_at"],
    ["assistant_availability", "presence_status"],
    ["assistant_location_pings", "captured_at"],
    ["assistant_location_pings", "accuracy_meters"],
    ["booking_realtime_events", "assistant_id"],
    ["booking_realtime_events", "cluster_id"]
  ];
  const columns = await database.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'zigo'
  `);
  const available = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = requiredColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((entry) => !available.has(entry));
  if (missingColumns.length) throw new Error(`Schema verification failed; missing: ${missingColumns.join(", ")}`);

  const requiredIndexes = [
    "idx_assistant_location_pings_assistant_captured",
    "idx_assistant_location_pings_booking_captured",
    "idx_admin_assignment_offer_expiry"
  ];
  const indexes = await database.query(`
    select ci.relname as indexname
    from pg_class ci
    join pg_namespace n on n.oid = ci.relnamespace
    join pg_index i on i.indexrelid = ci.oid
    where n.nspname = 'zigo'
      and ci.relname = any($1::text[])
      and i.indisvalid
      and i.indisready
  `, [requiredIndexes]);
  const presentIndexes = new Set(indexes.rows.map((row) => row.indexname));
  const missingIndexes = requiredIndexes.filter((name) => !presentIndexes.has(name));
  if (missingIndexes.length) throw new Error(`Index verification failed; missing: ${missingIndexes.join(", ")}`);
}

async function verifyBackup(databaseTarget) {
  const backupOption = optionValue("--backup");
  if (!backupOption) throw new Error("Remote migration requires --backup=<verified .dump file>.");
  const backupPath = path.resolve(backupOption);
  const manifestPath = `${backupPath}.manifest.json`;
  const [backupStat, manifestText] = await Promise.all([stat(backupPath), readFile(manifestPath, "utf8")]);
  const manifest = JSON.parse(manifestText);
  const maxAgeMinutes = Math.max(5, Number(process.env.MAX_BACKUP_AGE_MINUTES || 240));
  const ageMs = Date.now() - new Date(manifest.createdAt).getTime();

  if (!backupStat.isFile() || backupStat.size !== manifest.backupSizeBytes) throw new Error("Backup size does not match its manifest.");
  if (manifest.databaseHost.toLowerCase() !== databaseTarget.host.toLowerCase() || manifest.databaseName !== databaseTarget.database) {
    throw new Error("Backup target does not match the migration database.");
  }
  if (!manifest.verifiedWithPgRestore) throw new Error("Backup manifest is not marked as pg_restore verified.");
  if (!Number.isFinite(ageMs) || ageMs < -300000 || ageMs > maxAgeMinutes * 60000) {
    throw new Error(`Backup is not fresh enough; maximum age is ${maxAgeMinutes} minutes.`);
  }
  const sha256 = await hashFile(backupPath);
  if (sha256 !== manifest.sha256) throw new Error("Backup checksum verification failed.");
  console.log(`verified backup ${path.basename(backupPath)} (${backupStat.size} bytes)`);
}

function printStatus(identity, migrations, applied) {
  const pendingCount = migrations.filter((migration) => !applied.has(migration.id)).length;
  console.log(JSON.stringify({
    target: `${target.host}:${target.port}/${identity.database}`,
    serverAddress: identity.serverAddress,
    serverVersion: identity.serverVersion,
    mode: statusOnly ? "status" : productionMode ? "production-apply" : isLocalTarget ? "local-apply" : "remote-apply",
    pendingCount,
    migrations: migrations.map((migration) => ({
      id: migration.id,
      mode: migration.mode,
      status: applied.has(migration.id) ? "applied" : "pending"
    }))
  }, null, 2));
}

function optionValue(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1] || "";
  return process.argv.find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

function parseDatabaseUrl(value) {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error("DATABASE_URL must include a database name.");
  return { host: url.hostname, port: url.port || "5432", database };
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
