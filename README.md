# Zigo Admin

Admin backend and basic Bootstrap admin panel for the Zigo production schema.

## Run

```bash
npm.cmd install
npm.cmd run dev
```

## URLs

- Admin panel: http://localhost:4003/
- Health: http://localhost:4003/health
- Database health: http://localhost:4003/health/db
- Dashboard API: http://localhost:4003/admin/dashboard
- Users API: http://localhost:4003/users
- Admin actions API: http://localhost:4003/admin/actions

## Admin Login

- Email: `admin@zigo.local`
- Password: `SuperAdmin@123`

## Seed

```bash
npm.cmd run seed:basic
npm.cmd run seed:verify
```

## MVP Live Flow Migration

```bash
npm.cmd run migrate:mvp-live-flow
```

This creates the booking/task/payment lifecycle tables used by the customer, assistant, and admin live-operation APIs.

## Live Operations APIs

- Live operations: `GET /operations/live`
- Manual assign: `POST /operations/bookings/:id/assign`
- Reassign: `POST /operations/bookings/:id/reassign`
- Admin cancel: `POST /operations/bookings/:id/cancel`
- Force close: `POST /operations/bookings/:id/force-close`
- Launch report: `GET /reports/launch`

The Bootstrap panel calls these APIs step by step:

1. `POST /auth/login`
2. Store returned JWT token in browser local storage.
3. Call protected `GET /admin/dashboard`.
4. Call protected `GET /users`.
5. Call protected `GET /admin/actions`.
