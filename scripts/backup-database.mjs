import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const target = parseDatabaseUrl(connectionString);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const requestedOutput = optionValue("--output");
const backupPath = path.resolve(
  requestedOutput || path.join(repoRoot, ".release-backups", `${safePart(target.database)}-${timestamp}.dump`)
);
const manifestPath = `${backupPath}.manifest.json`;
const partialPath = `${backupPath}.partial`;

await mkdir(path.dirname(backupPath), { recursive: true });
await failIfExists(backupPath);
await failIfExists(manifestPath);
await failIfExists(partialPath);

const pgDump = await resolvePostgresTool("pg_dump", process.env.PG_DUMP_BIN);
const pgRestore = await resolvePostgresTool(
  "pg_restore",
  process.env.PG_RESTORE_BIN || siblingTool(pgDump, "pg_restore")
);
const postgresEnv = databaseEnvironment(target);

try {
  await run(pgDump, [
    "--format=custom",
    "--compress=6",
    "--no-owner",
    "--no-acl",
    `--file=${partialPath}`,
    `--dbname=${target.database}`
  ], postgresEnv);

  const backupStat = await stat(partialPath);
  if (!backupStat.isFile() || backupStat.size < 1024) {
    throw new Error("pg_dump produced an empty or incomplete backup.");
  }

  await run(pgRestore, ["--list", partialPath], postgresEnv, { discardStdout: true });
  const sha256 = await hashFile(partialPath);
  await rename(partialPath, backupPath);

  const client = new pg.Client({ connectionString, application_name: "zigo-release-backup" });
  await client.connect();
  let metadata;
  try {
    const result = await client.query(`
      select current_database() as database,
        current_setting('server_version') as "serverVersion",
        pg_database_size(current_database())::text as "databaseSizeBytes",
        now() as "capturedAt"
    `);
    metadata = result.rows[0];
  } finally {
    await client.end();
  }

  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    databaseHost: target.host,
    databasePort: target.port,
    databaseName: metadata.database,
    databaseSizeBytes: Number(metadata.databaseSizeBytes),
    serverVersion: metadata.serverVersion,
    backupFile: path.basename(backupPath),
    backupSizeBytes: backupStat.size,
    sha256,
    verifiedWithPgRestore: true
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

  console.log(JSON.stringify({
    status: "backup_verified",
    target: `${target.host}:${target.port}/${target.database}`,
    backupPath,
    manifestPath,
    backupSizeBytes: backupStat.size,
    sha256
  }, null, 2));
} catch (error) {
  await unlink(partialPath).catch(() => undefined);
  throw error;
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
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslMode: url.searchParams.get("sslmode") || ""
  };
}

function databaseEnvironment(value) {
  const env = {
    ...process.env,
    PGHOST: value.host,
    PGPORT: value.port,
    PGUSER: value.user,
    PGPASSWORD: value.password,
    PGDATABASE: value.database
  };
  if (value.sslMode) env.PGSSLMODE = value.sslMode;
  return env;
}

async function resolvePostgresTool(name, configuredPath) {
  const extension = process.platform === "win32" ? ".exe" : "";
  const candidates = [configuredPath].filter(Boolean);
  if (process.platform === "win32") {
    for (const version of [18, 17, 16, 15, 14, 13]) {
      candidates.push(`C:\\Program Files\\PostgreSQL\\${version}\\bin\\${name}.exe`);
    }
  }
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known installation path.
    }
  }
  return `${name}${extension}`;
}

function siblingTool(command, name) {
  if (!path.isAbsolute(command)) return "";
  return path.join(path.dirname(command), `${name}${path.extname(command)}`);
}

function run(command, args, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", options.discardStdout ? "ignore" : "inherit", "inherit"]
    });
    child.once("error", (error) => reject(new Error(`Unable to start ${path.basename(command)}: ${error.message}`)));
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${path.basename(command)} exited with code ${code}.`)));
  });
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function failIfExists(filePath) {
  try {
    await access(filePath);
    throw new Error(`Refusing to overwrite existing file: ${filePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function safePart(value) {
  return String(value).replace(/[^a-z0-9_.-]+/gi, "-");
}
