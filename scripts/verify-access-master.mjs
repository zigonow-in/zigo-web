import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const result = await pool.query(`
    select
      (select count(*) from zigo.modules) as modules,
      (select count(*) from zigo.permissions) as permissions,
      (select count(*) from zigo.module_permissions) as module_permissions,
      (select count(*) from zigo.roles where code = 'super_admin') as super_admin_roles,
      (select count(*) from zigo.role_modules rm join zigo.roles r on r.id = rm.role_id where r.code = 'super_admin') as super_admin_role_modules,
      (select count(*) from zigo.role_permissions rp join zigo.roles r on r.id = rp.role_id where r.code = 'super_admin') as super_admin_role_permissions,
      (select count(*) from zigo.user_roles ur join zigo.roles r on r.id = ur.role_id join zigo.users u on u.id = ur.user_id where r.code = 'super_admin' and lower(u.email::text) = 'admin@zigo.local') as super_admin_user_roles,
      (select count(*) from zigo.roles where code in ('super_admin', 'admin', 'customer', 'assistant', 'manager', 'staff')) as zigo_roles,
      (select count(*) from zigo.role_modules rm join zigo.roles r on r.id = rm.role_id where r.code = 'admin') as admin_role_modules,
      (select count(*) from zigo.role_permissions rp join zigo.roles r on r.id = rp.role_id where r.code = 'admin') as admin_role_permissions
  `);

  console.table(result.rows);
} finally {
  await pool.end();
}
