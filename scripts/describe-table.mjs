import "dotenv/config";
import pg from "pg";

const tableName = process.argv[2];

if (!tableName) {
  console.error("Usage: node scripts/describe-table.mjs <table_name>");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const result = await pool.query(
    `
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'zigo'
        and table_name = $1
      order by ordinal_position
    `,
    [tableName]
  );

  console.table(result.rows);
} finally {
  await pool.end();
}
