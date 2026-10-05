import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  if (process.argv.includes("--local-only") && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname)) {
    throw new Error("Local verification skipped: DATABASE_URL targets a remote database.");
  }
  const sql = await readFile(new URL("../database/migrations/20261004_location_market_hierarchy.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("Location hierarchy migration completed.");
} finally {
  await pool.end();
}
