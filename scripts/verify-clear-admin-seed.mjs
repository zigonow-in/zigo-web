import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const result = await pool.query(`
    select
      (select count(*) from zigo.roles) as roles,
      (select count(*) from zigo.permissions) as permissions,
      (select count(*) from zigo.modules) as modules,
      (select count(*) from zigo.user_roles) as user_roles,
      (
        select count(*)
        from zigo.users
        where lower(email::text) in ('admin@zigo.local', 'customer@zigo.local', 'assistant@zigo.local')
      ) as seed_users
  `);

  console.table(result.rows);
} finally {
  await pool.end();
}
