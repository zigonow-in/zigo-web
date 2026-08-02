import "dotenv/config";
import pg from "pg";

const tableName = process.argv[2];

if (!tableName) {
  console.error("Usage: node scripts/table-constraints.mjs <table_name>");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const result = await pool.query(
    `
      select
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      from information_schema.table_constraints tc
      left join information_schema.key_column_usage kcu
        on kcu.constraint_schema = tc.constraint_schema
       and kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
       and kcu.table_name = tc.table_name
      where tc.table_schema = 'zigo'
        and tc.table_name = $1
      order by tc.constraint_type, tc.constraint_name, kcu.ordinal_position
    `,
    [tableName]
  );

  console.table(result.rows);
} finally {
  await pool.end();
}
