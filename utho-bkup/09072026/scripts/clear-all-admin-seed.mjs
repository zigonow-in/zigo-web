import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const seedEmails = [
  "admin@zigo.local",
  "customer@zigo.local",
  "assistant@zigo.local"
];

const client = await pool.connect();

try {
  await client.query("begin");

  const seededUsers = await client.query(
    `
      select id
      from zigo.users
      where lower(email::text) = any($1::text[])
         or metadata->>'seeded' = 'true'
    `,
    [seedEmails]
  );
  const userIds = seededUsers.rows.map((row) => row.id);

  const seededAssistants = await client.query(
    `
      select id
      from zigo.assistants
      where user_id = any($1::uuid[])
         or metadata->>'seeded' = 'true'
    `,
    [userIds]
  );
  const assistantIds = seededAssistants.rows.map((row) => row.id);

  const seededCustomers = await client.query(
    `
      select id
      from zigo.customers
      where user_id = any($1::uuid[])
         or preferences->>'seeded' = 'true'
    `,
    [userIds]
  );
  const customerIds = seededCustomers.rows.map((row) => row.id);

  await client.query("delete from zigo.user_permissions where true").catch(() => {});
  await client.query("delete from zigo.user_modules where true").catch(() => {});
  await client.query("delete from zigo.user_roles where true");
  await client.query("delete from zigo.role_permissions where true");
  await client.query("delete from zigo.role_modules where true").catch(() => {});
  await client.query("delete from zigo.module_permissions where true").catch(() => {});
  await client.query("delete from zigo.role_verification_requirements where true").catch(() => {});

  if (assistantIds.length) {
    await client.query("delete from zigo.assistant_vehicle_documents where vehicle_id in (select id from zigo.assistant_vehicles where assistant_id = any($1::uuid[]))", [assistantIds]).catch(() => {});
    await client.query("delete from zigo.assistant_vehicles where assistant_id = any($1::uuid[])", [assistantIds]).catch(() => {});
    await client.query("delete from zigo.assistant_documents where assistant_id = any($1::uuid[])", [assistantIds]).catch(() => {});
    await client.query("delete from zigo.assistant_cluster_map where assistant_id = any($1::uuid[])", [assistantIds]).catch(() => {});
    await client.query("delete from zigo.assistants where id = any($1::uuid[])", [assistantIds]);
  }

  if (customerIds.length) {
    await client.query("delete from zigo.customer_addresses where customer_id = any($1::uuid[])", [customerIds]).catch(() => {});
    await client.query("delete from zigo.customer_favorite_places where customer_id = any($1::uuid[])", [customerIds]).catch(() => {});
    await client.query("delete from zigo.customer_memberships where customer_id = any($1::uuid[])", [customerIds]).catch(() => {});
    await client.query("delete from zigo.customer_notes where customer_id = any($1::uuid[])", [customerIds]).catch(() => {});
    await client.query("delete from zigo.customers where id = any($1::uuid[])", [customerIds]);
  }

  if (userIds.length) {
    await client.query("delete from zigo.devices where user_id = any($1::uuid[])", [userIds]).catch(() => {});
    await client.query("delete from zigo.admin_actions where actor_user_id = any($1::uuid[])", [userIds]).catch(() => {});
    await client.query("delete from zigo.users where id = any($1::uuid[])", [userIds]);
  }

  await client.query("delete from zigo.permissions where true");
  await client.query("delete from zigo.roles where true");
  await client.query("delete from zigo.modules where true").catch(() => {});
  await client.query("delete from zigo.document_types where true").catch(() => {});

  await client.query("commit");

  console.log("All admin seed/setup data cleared. Schema and tables were kept.");
  console.table([
    {
      deletedSeedUsers: userIds.length,
      deletedSeedAssistants: assistantIds.length,
      deletedSeedCustomers: customerIds.length
    }
  ]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
