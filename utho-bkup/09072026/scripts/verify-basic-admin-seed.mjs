import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const counts = await pool.query(`
    select
      (select count(*) from zigo.roles) as roles,
      (select count(*) from zigo.permissions) as permissions,
      (select count(*) from zigo.role_permissions) as role_permissions,
      (select count(*) from zigo.user_roles) as user_roles,
      (select count(*) from zigo.users where lower(email::text) = 'admin@zigo.local') as super_admin_users
  `);

  const superAdmin = await pool.query(`
    select
      u.email::text as email,
      u.phone,
      u.display_name as "displayName",
      r.code as role
    from zigo.users u
    join zigo.user_roles ur on ur.user_id = u.id
    join zigo.roles r on r.id = ur.role_id
    where lower(u.email::text) = 'admin@zigo.local'
    order by r.code
  `);

  console.table(counts.rows);
  console.table(superAdmin.rows);
} finally {
  await pool.end();
}
