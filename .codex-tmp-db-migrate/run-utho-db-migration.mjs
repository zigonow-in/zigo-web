import fs from "node:fs";
import { Client } from "ssh2";

const host = "103.209.146.160";
const username = "root";
const password = "@5b6VjEb6BNByN";
const localDump = ".codex-tmp-db-migrate/local-zigo-prod.sql";
const remoteDump = "/opt/zigo/admin/backups/local-zigo-prod.sql";

function connect() {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on("ready", () => resolve(client))
      .on("error", reject)
      .connect({ host, username, password, readyTimeout: 20_000 });
  });
}

function upload(client) {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.mkdir("/opt/zigo/admin/backups", { mode: 0o755 }, () => {
        sftp.fastPut(localDump, remoteDump, (putError) => {
          if (putError) reject(putError);
          else resolve();
        });
      });
    });
  });
}

function exec(client, command) {
  return new Promise((resolve, reject) => {
    client.exec(command, { pty: false }, (error, stream) => {
      if (error) return reject(error);
      let stdout = "";
      let stderr = "";
      stream.on("data", (data) => {
        stdout += data;
        process.stdout.write(data);
      });
      stream.stderr.on("data", (data) => {
        stderr += data;
        process.stderr.write(data);
      });
      stream.on("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`Remote command failed with exit code ${code}`));
      });
    });
  });
}

if (!fs.existsSync(localDump)) {
  throw new Error(`Local dump not found: ${localDump}`);
}

const client = await connect();
try {
  console.log("Connected to Utho.");
  await exec(client, "mkdir -p /opt/zigo/admin/backups");
  console.log("Uploading local dump...");
  await upload(client);
  console.log("Uploaded local dump.");

  const remoteCommand = String.raw`
set -e
cd /opt/zigo/admin
set -a
. ./.env
set +a
ts=$(date +%Y%m%d-%H%M%S)
echo "Taking live backup: backups/live-before-local-migration-$ts.dump"
pg_dump --no-owner --no-privileges --format=custom --file "backups/live-before-local-migration-$ts.dump" "$DATABASE_URL"
echo "Stopping PM2 app if running..."
pm2 stop zigo-admin || true
restore_ok=0
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "backups/local-zigo-prod.sql"; then
  restore_ok=1
fi
echo "Restarting PM2 app..."
pm2 restart zigo-admin || pm2 start npm --name zigo-admin -- run start
if [ "$restore_ok" != "1" ]; then
  echo "Restore failed; live backup retained in backups/live-before-local-migration-$ts.dump" >&2
  exit 1
fi
echo "Verifying live counts..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select 'customers=' || count(*) from zigo.customers; select 'assistants=' || count(*) from zigo.assistants; select 'service_requests=' || count(*) from zigo.service_requests; select 'categories=' || count(*) from zigo.categories; select 'category_price_rules=' || count(*) from zigo.category_price_rules; select 'booking_engine_rules=' || count(*) from zigo.booking_engine_rules;"
echo "DONE"
`;

  await exec(client, `bash -lc ${JSON.stringify(remoteCommand)}`);
} finally {
  client.end();
}
