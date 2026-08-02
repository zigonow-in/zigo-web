# Zigo Demo Release Notes

## Database Sync - 2026-07-22

The live `zigo-prod` database was compared with the local PostgreSQL backup and
updated using the idempotent migration below. No full database dump was restored
to production, and no live operational records were deleted or overwritten.

- Migration: `database/migrations/20260722_sync_schema_and_master_seed.sql`
- Added schema: booking billing snapshots, invoice email jobs, customer support
  tickets/messages, and tax master rules.
- Upserted master data: service masters, categories, category prices, booking
  quick replies, payment methods, and tax rules.
- Preserved live users, assistants, bookings, assignments, payments, addresses,
  files, chats, reviews, and audit/event history.

Run on deployments that do not yet contain this sync:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f database/migrations/20260722_sync_schema_and_master_seed.sql
```

The migration can be rerun safely; seed rows are upserted by UUID and cannot be
duplicated.

Release date: 2026-07-18

## Scope

This package contains the recent Zigo Demo application updates for Admin, Customer portal, Assistant portal, payments, location, booking rules, category/service master, category pricing, and UI refinements.

No full PostgreSQL database dump is included.

## Files To Upload

Upload the changed application files and assets from this release package. Important paths include:

- `package.json`
- `package-lock.json`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/portal.js`
- `public/portal.css`
- `public/portal.html`
- `public/assets/connection-lost.png`
- `public/assets/india-flag.svg`
- `public/uploads/documents/*`
- `public/uploads/images/*`
- `src/app.ts`
- `src/config/env.ts`
- `src/http/security.ts`
- `src/modules/masters/masters.repository.ts`
- `src/modules/masters/masters.routes.ts`
- `src/modules/operations/operations.repository.ts`
- `src/modules/operations/operations.routes.ts`
- `src/modules/payments/payments.repository.ts`
- `src/modules/portal/portal.repository.ts`
- `src/modules/portal/portal.routes.ts`
- `src/utils/bookingReference.ts`
- `database/migrations/20260718_zigo_demo_release.sql`

Do not upload `.env` as a public/static file.

## Database Migration

Run the new migration after uploading files and before restarting PM2:

```bash
psql "$DATABASE_URL" -f database/migrations/20260718_zigo_demo_release.sql
```

The migration is backward compatible and idempotent. It creates or updates only the required tables/columns/indexes for:

- Category Service Master
- Category Price enable/expand support
- Payment Mode Master
- Razorpay payment tracking and webhooks
- Service request payment status columns

## Server Environment Variables

Set these on the server environment or private backend `.env` file as required:

```text
RAZORPAY_KEY_ID=<server value>
RAZORPAY_KEY_SECRET=<server value>
RAZORPAY_WEBHOOK_SECRET=<server value>
```

Do not expose secret values in frontend code.

## Deployment Steps

1. Backup current application files on the server.
2. Upload the release package files to the Node application directory.
3. Ensure `.env` is not overwritten by the package.
4. Run:

```bash
npm install
npm run build
psql "$DATABASE_URL" -f database/migrations/20260718_zigo_demo_release.sql
pm2 restart <zigo-pm2-app-name>
```

5. Verify:
   - Admin login opens.
   - Customer `/admin/customer` opens.
   - Assistant `/admin/assistant` opens.
   - Home category/service images load under `/admin`.
   - Booking review and Track Booking pages open.
   - Payment mode and Razorpay flow open without CSP errors.
   - Razorpay webhook endpoint is reachable at `/admin/portal/webhooks/razorpay`.

## Build Verification

Run before deployment:

```bash
npm run build
```

## Notes

- No destructive SQL is included.
- No `DROP DATABASE`, `DROP SCHEMA`, or full database dump is included.
- Existing migration files were not modified.
- Upload media files only if the live server needs the same uploaded category/service/document images.
