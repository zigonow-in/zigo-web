import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getOrCreateUser(client, { email, phone, displayName, app }) {
  const existing = await client.query("select id from zigo.users where email::text = $1 or phone = $2 limit 1", [email, phone]);
  if (existing.rows[0]) return existing.rows[0].id;
  const passwordHash = await bcrypt.hash("Seed@1234", 12);
  const result = await client.query(
    `
      insert into zigo.users (email, phone, password_hash, display_name, metadata)
      values ($1, $2, $3, $4, $5)
      returning id
    `,
    [email, phone, passwordHash, displayName, { accountStatus: "active", app, seeded: true }]
  );
  return result.rows[0].id;
}

async function getOrCreateState(client) {
  const existing = await client.query("select id from zigo.states where code = 'HR' limit 1");
  if (existing.rows[0]) return existing.rows[0].id;
  const result = await client.query(
    "insert into zigo.states (code, name, country_name, is_active, metadata) values ('HR', 'Haryana', 'India', true, '{\"seeded\": true}'::jsonb) returning id"
  );
  return result.rows[0].id;
}

async function getOrCreateCity(client, stateId) {
  const existing = await client.query("select id from zigo.cities where code = 'GURGAON' limit 1");
  if (existing.rows[0]) return existing.rows[0].id;
  const result = await client.query(
    "insert into zigo.cities (state_id, code, name, is_active, metadata) values ($1, 'GURGAON', 'Gurgaon', true, '{\"seeded\": true}'::jsonb) returning id",
    [stateId]
  );
  return result.rows[0].id;
}

async function getOrCreateCluster(client, cityId) {
  const existing = await client.query("select id from zigo.clusters where code = 'DEMO-GGN-1' limit 1");
  if (existing.rows[0]) return existing.rows[0].id;
  const polygon = "POLYGON((77.0266 28.4595, 77.0766 28.4595, 77.0766 28.4895, 77.0266 28.4895, 77.0266 28.4595))";
  const result = await client.query(
    `
      insert into zigo.clusters
        (city_id, name, code, priority, is_booking_enabled, description, areas_description, polygon_description, metadata)
      values ($1, 'Demo Gurgaon Cluster', 'DEMO-GGN-1', 1, true, 'Seed cluster for booking testing', 'Gurgaon central demo areas', $2, '{"seeded": true}'::jsonb)
      returning id
    `,
    [cityId, polygon]
  );
  return result.rows[0].id;
}

async function getOrCreateService(client) {
  const existing = await client.query("select id from zigo.services where code = 'BRING_BUY' limit 1");
  if (existing.rows[0]) return existing.rows[0].id;
  const result = await client.query(
    `
      insert into zigo.services (code, name, description, is_active, sort_order, metadata)
      values ('BRING_BUY', 'Bring & Buy', 'Seed service for booking testing', true, 1, '{"seeded": true}'::jsonb)
      returning id
    `
  );
  return result.rows[0].id;
}

async function getOrCreateCustomer(client, clusterId) {
  const userId = await getOrCreateUser(client, {
    email: "seed.customer@zigonow.in",
    phone: "9000001001",
    displayName: "Seed Customer",
    app: "customer"
  });
  const existing = await client.query("select id from zigo.customers where customer_code = 'CUST-SEED-001' limit 1");
  let customerId = existing.rows[0]?.id;
  if (!customerId) {
    const customer = await client.query(
      "insert into zigo.customers (user_id, customer_code, preferences) values ($1, 'CUST-SEED-001', '{\"seeded\": true}'::jsonb) returning id",
      [userId]
    );
    customerId = customer.rows[0].id;
  }
  await client.query(
    `
      insert into zigo.customer_addresses
        (customer_id, label, address_text, latitude, longitude, city, postal_code, cluster_id, is_default, metadata)
      values ($1, 'Home', 'Seed customer home, Gurgaon', 28.473225, 77.055712, 'Gurgaon', '122001', $2, true, '{"seeded": true}'::jsonb)
      on conflict do nothing
    `,
    [customerId, clusterId]
  );
  return customerId;
}

async function getOrCreateAssistant(client, clusterId) {
  const userId = await getOrCreateUser(client, {
    email: "seed.assistant@zigonow.in",
    phone: "9000002001",
    displayName: "Seed Assistant",
    app: "assistant"
  });
  const existing = await client.query("select id from zigo.assistants where assistant_code = 'AST-SEED-001' limit 1");
  let assistantId = existing.rows[0]?.id;
  if (!assistantId) {
    const assistant = await client.query(
      `
        insert into zigo.assistants (user_id, assistant_code, current_cluster_id, metadata)
        values ($1, 'AST-SEED-001', $2, '{"seeded": true, "verificationStatus": "verified"}'::jsonb)
        returning id
      `,
      [userId, clusterId]
    );
    assistantId = assistant.rows[0].id;
  }
  await client.query(`
    alter table if exists zigo.assistant_availability
      add column if not exists status_code text not null default 'offline',
      add column if not exists capacity integer not null default 1,
      add column if not exists updated_at timestamptz not null default now();
  `);
  const availability = await client.query("select id from zigo.assistant_availability where assistant_id = $1 limit 1", [assistantId]);
  if (availability.rows[0]) {
    await client.query(
      `
        update zigo.assistant_availability
        set status_code = 'available', cluster_id = $2, latitude = 28.473225, longitude = 77.055712, capacity = 1, updated_at = now()
        where assistant_id = $1
      `,
      [assistantId, clusterId]
    );
  } else {
    await client.query(
      `
        insert into zigo.assistant_availability (assistant_id, status_code, cluster_id, latitude, longitude, capacity)
        values ($1, 'available', $2, 28.473225, 77.055712, 1)
      `,
      [assistantId, clusterId]
    );
  }
  return assistantId;
}

async function seedBooking(client, { seedKey, requestNumber, statusCode, customerId, assistantId, clusterId, serviceId }) {
  const existing = await client.query("select id from zigo.service_requests where metadata->>'seedKey' = $1 limit 1", [seedKey]);
  let requestId = existing.rows[0]?.id;
  if (requestId) {
    await client.query(
      `
        update zigo.service_requests
        set status_code = $2,
            accepted_assignment_id = null,
            completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else null end,
            updated_at = now()
        where id = $1
      `,
      [requestId, statusCode]
    );
    await client.query("delete from zigo.task_assignments where request_id = $1 or service_request_id = $1", [requestId]);
  } else {
    const request = await client.query(
      `
        insert into zigo.service_requests
          (request_number, customer_id, service_id, cluster_id, status_code, notes, duration_minutes, estimated_amount_paise, currency, metadata, completed_at)
        values ($1, $2, $3, $4, $5, $6, 30, 19900, 'INR', $7, case when $5 = 'completed' then now() else null end)
        returning id
      `,
      [requestNumber, customerId, serviceId, clusterId, statusCode, `Seed booking ${seedKey}`, { seeded: true, seedKey }]
    );
    requestId = request.rows[0].id;
    await client.query(
      `
        insert into zigo.request_locations (service_request_id, sequence, location_type, name, address, latitude, longitude, metadata)
        values ($1, 1, 'store', 'Seed location', 'Seed customer home, Gurgaon', 28.473225, 77.055712, '{"seeded": true}'::jsonb)
      `,
      [requestId]
    );
  }
  if (["assigned", "accepted", "in_progress", "approval_pending"].includes(statusCode)) {
    const assignment = await client.query(
      `
        insert into zigo.task_assignments
          (request_id, service_request_id, assistant_id, status_code, expires_at, admin_reason, metadata)
        values ($1, $1, $2, 'offered', now() + interval '5 minutes', 'Seed assignment', '{"seeded": true}'::jsonb)
        returning id
      `,
      [requestId, assistantId]
    );
    await client.query("update zigo.service_requests set accepted_assignment_id = $2 where id = $1", [requestId, assignment.rows[0].id]);
  }
  return requestId;
}

const client = await pool.connect();
try {
  await client.query("begin");
  const stateId = await getOrCreateState(client);
  const cityId = await getOrCreateCity(client, stateId);
  const clusterId = await getOrCreateCluster(client, cityId);
  const serviceId = await getOrCreateService(client);
  const customerId = await getOrCreateCustomer(client, clusterId);
  const assistantId = await getOrCreateAssistant(client, clusterId);

  await seedBooking(client, { seedKey: "pending_assign", requestNumber: "SEED-BOOK-001", statusCode: "queued", customerId, assistantId, clusterId, serviceId });
  await seedBooking(client, { seedKey: "processing", requestNumber: "SEED-BOOK-002", statusCode: "assigned", customerId, assistantId, clusterId, serviceId });
  await seedBooking(client, { seedKey: "success", requestNumber: "SEED-BOOK-003", statusCode: "completed", customerId, assistantId, clusterId, serviceId });
  await seedBooking(client, { seedKey: "failure", requestNumber: "SEED-BOOK-004", statusCode: "failed", customerId, assistantId, clusterId, serviceId });
  await seedBooking(client, { seedKey: "hold", requestNumber: "SEED-BOOK-005", statusCode: "hold", customerId, assistantId, clusterId, serviceId });

  await client.query("commit");
  console.log("Booking seed completed.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
