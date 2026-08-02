import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const modules = [
  { code: "admin_panel", name: "Admin Panel", sortOrder: 10 },
  { code: "customer_app", name: "Customer App", sortOrder: 20 },
  { code: "assistant_app", name: "Assistant App", sortOrder: 30 }
];

const superAdmin = {
  email: "admin@zigo.local",
  phone: "9999999999",
  password: "SuperAdmin@123",
  displayName: "ZIGO Super Admin"
};

const client = await pool.connect();

try {
  await client.query("begin");

  await client.query("delete from zigo.user_permissions");
  await client.query("delete from zigo.user_modules");
  await client.query("delete from zigo.user_roles");
  await client.query("delete from zigo.role_permissions");
  await client.query("delete from zigo.role_modules");
  await client.query("delete from zigo.module_permissions");
  await client.query("delete from zigo.role_verification_requirements where true").catch(() => {});
  await client.query("delete from zigo.roles");
  await client.query("delete from zigo.permissions");
  await client.query("delete from zigo.modules");

  await client.query("delete from zigo.assistant_vehicle_documents where true").catch(() => {});
  await client.query("delete from zigo.assistant_vehicles where true").catch(() => {});
  await client.query("delete from zigo.document_types where true").catch(() => {});

  const moduleIds = [];
  for (const module of modules) {
    const result = await client.query(
      `
        insert into zigo.modules (code, name, sort_order, is_active)
        values ($1, $2, $3, true)
        returning id
      `,
      [module.code, module.name, module.sortOrder]
    );
    moduleIds.push(result.rows[0].id);
  }

  const role = await client.query(
    `
      insert into zigo.roles (code, name, description, is_system)
      values ('super_admin', 'Super Admin', 'Full access for initial setup', true)
      returning id
    `
  );

  const passwordHash = await bcrypt.hash(superAdmin.password, 12);
  const existingUser = await client.query("select id from zigo.users where lower(email::text) = lower($1)", [
    superAdmin.email
  ]);

  let userId;
  if (existingUser.rows[0]) {
    userId = existingUser.rows[0].id;
    await client.query(
      `
        update zigo.users
        set phone = $2,
            password_hash = $3,
            display_name = $4,
            metadata = '{"accountStatus": "active", "isLoginWithOtp": true, "isLoginWithPassword": true, "isDocumentRequired": false}'::jsonb,
            deleted_at = null,
            updated_at = now()
        where id = $1
      `,
      [userId, superAdmin.phone, passwordHash, superAdmin.displayName]
    );
  } else {
    const created = await client.query(
      `
        insert into zigo.users (email, phone, password_hash, display_name, metadata)
        values ($1, $2, $3, $4, '{"accountStatus": "active", "isLoginWithOtp": true, "isLoginWithPassword": true, "isDocumentRequired": false}'::jsonb)
        returning id
      `,
      [superAdmin.email, superAdmin.phone, passwordHash, superAdmin.displayName]
    );
    userId = created.rows[0].id;
  }

  await client.query("insert into zigo.user_roles (user_id, role_id) values ($1, $2)", [
    userId,
    role.rows[0].id
  ]);

  for (const moduleId of moduleIds) {
    await client.query("insert into zigo.role_modules (role_id, module_id) values ($1, $2)", [
      role.rows[0].id,
      moduleId
    ]);
    await client.query("insert into zigo.user_modules (user_id, module_id) values ($1, $2)", [
      userId,
      moduleId
    ]);
  }

  await client.query("commit");
  console.log("Minimal admin reset completed.");
  console.table([{ modules: modules.length, role: "super_admin", email: superAdmin.email, password: superAdmin.password }]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
