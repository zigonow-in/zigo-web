# Production Release Runbook

This release path preserves live data. It does not run seed, reset, clear, or legacy bulk-import scripts.

## 1. Build and verify

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run db:migrate:status -- --confirm-host=<production-db-host>
```

Review the pending migration list before continuing.

## 2. Create a database backup

Prefer a managed-database snapshot in addition to this logical backup. Then run:

```powershell
npm.cmd run db:backup -- --output=D:\zigo-backups\zigo-before-<release>.dump
```

The command creates a PostgreSQL custom-format archive, validates it with `pg_restore --list`, calculates SHA-256, and writes a matching `.manifest.json` file. Do not continue if either file is missing.

## 3. Apply release migrations

```powershell
$env:RELEASE_VERSION="<git-commit-or-release-id>"
npm.cmd run db:migrate:release -- --confirm-host=<production-db-host> --backup=D:\zigo-backups\zigo-before-<release>.dump
```

Remote migration is refused unless:

- the confirmed hostname exactly matches `DATABASE_URL`;
- the backup and manifest belong to the same host and database;
- `pg_restore` validation succeeded;
- the backup checksum and size still match; and
- the backup is less than four hours old by default.

Migrations use an advisory lock, checksums, a migration ledger, short lock timeouts, transactions for schema changes, and concurrent index creation. Current release SQL is additive and does not delete or replace business records.

## 4. Deploy the application

Deploy the same tested commit, install dependencies with `npm ci`, and restart the configured application service. This repository does not currently define the production service manager or CI/CD target, so use the production host's existing restart mechanism.

Check immediately after restart:

```text
GET /health
GET /health/db
```

Then verify admin login, customer booking confirmation, assistant realtime assignment, GPS update, and task start/finish.

## Rollback

Roll back the application to the prior commit if application health fails. Keep the additive database migration in place; the previous application version remains compatible with the added nullable columns and indexes. Restore the database only for confirmed data corruption, not for an application-only rollback.

Never run `seed:*`, `reset:*`, `clear:*`, `database/database/zigo-prod.sql`, or `20260722_sync_schema_and_master_seed.sql` during a production release.
